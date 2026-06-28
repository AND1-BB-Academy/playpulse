import dotenv from 'dotenv'
import Stripe from 'stripe'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: '.env.local' })

export const config = {
    api: {
        bodyParser: false,
    },
}

let stripeClient = null

const getStripe = () => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY is missing')
    }

    if (!stripeClient) {
        stripeClient = new Stripe(stripeSecretKey)
    }

    return stripeClient
}

const getRawBody = async (req) => {
    const chunks = []

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    return Buffer.concat(chunks)
}



const parseEventForLocalTest = (req, rawBody) => {
    const parsedEvent = parseEventPayload(req, rawBody)

    if (!parsedEvent) {
        throw new Error('Webhook payload is empty')
    }

    return parsedEvent
}



const getFirestoreDb = () => {
    if (!getApps().length) {
        let serviceAccount

        if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
            serviceAccount = JSON.parse(
                Buffer.from(
                    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
                    'base64'
                ).toString('utf8')
            )
        } else {
            const serviceAccountPath = path.join(
                process.cwd(),
                'firebase-service-account.json'
            )

            if (!fs.existsSync(serviceAccountPath)) {
                throw new Error('firebase-service-account.json is missing')
            }

            serviceAccount = JSON.parse(
                fs.readFileSync(serviceAccountPath, 'utf8')
            )
        }

        console.log('Service account debug:', {
            hasProjectId: Boolean(serviceAccount.project_id),
            hasClientEmail: Boolean(serviceAccount.client_email),
            hasPrivateKey: Boolean(serviceAccount.private_key),
        })

        if (
            !serviceAccount.project_id ||
            !serviceAccount.client_email ||
            !serviceAccount.private_key
        ) {
            throw new Error('firebase-service-account.json is invalid')
        }

        initializeApp({
            credential: cert({
                projectId: serviceAccount.project_id,
                clientEmail: serviceAccount.client_email,
                privateKey: serviceAccount.private_key,
            }),
        })
    }

    return getFirestore()
}

const getCurrentPeriodEnd = (subscription) => {
    if (!subscription?.current_period_end) {
        return null
    }

    return new Date(subscription.current_period_end * 1000).toISOString()
}

const getSubscriptionId = (subscription) => {
    if (!subscription) {
        return ''
    }

    if (typeof subscription === 'string') {
        return subscription
    }

    return subscription.id || ''
}

const getCustomerId = (customer) => {
    if (!customer) {
        return ''
    }

    if (typeof customer === 'string') {
        return customer
    }

    return customer.id || ''
}

const getUidFromSession = (session) => {
    return (
        session.client_reference_id ||
        session.metadata?.uid ||
        session.metadata?.firebaseUid ||
        ''
    )
}

const getUidFromSubscription = (subscription) => {
    return (
        subscription.metadata?.uid ||
        subscription.metadata?.firebaseUid ||
        ''
    )
}

const updateUserToPro = async ({
    db,
    uid,
    stripeCustomerId,
    stripeSubscriptionId,
    subscriptionStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    source,
}) => {
    if (!uid) {
        console.warn('No uid found. Skip Firestore pro update.', {
            source,
            stripeCustomerId,
            stripeSubscriptionId,
            subscriptionStatus,
        })
        return
    }

    await db.collection('users').doc(uid).set(
        {
            plan: 'pro',
            stripeCustomerId: stripeCustomerId || '',
            stripeSubscriptionId: stripeSubscriptionId || '',
            subscriptionStatus: subscriptionStatus || '',
            currentPeriodEnd: currentPeriodEnd || null,
            cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
            updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
    )

    console.log(`User ${uid} upgraded to pro from ${source}`)
}

const updateUserSubscriptionStatus = async ({
    db,
    uid,
    subscription,
}) => {
    if (!uid) {
        console.warn('No uid found. Skip subscription update.', {
            subscriptionId: subscription?.id || '',
            status: subscription?.status || '',
        })
        return
    }

    const shouldKeepPro =
        subscription.status === 'active' ||
        subscription.status === 'trialing'

    await db.collection('users').doc(uid).set(
        {
            plan: shouldKeepPro ? 'pro' : 'free',
            stripeSubscriptionId: subscription.id || '',
            stripeCustomerId: getCustomerId(subscription.customer),
            subscriptionStatus: subscription.status || '',
            currentPeriodEnd: getCurrentPeriodEnd(subscription),
            cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    )

    console.log(`User ${uid} subscription updated: ${subscription.status}`)
}

const downgradeUserToFree = async ({
    db,
    uid,
    subscription,
}) => {
    if (!uid) {
        console.warn('No uid found. Skip downgrade.', {
            subscriptionId: subscription?.id || '',
            status: subscription?.status || '',
        })
        return
    }

    await db.collection('users').doc(uid).set(
        {
            plan: 'free',
            stripeSubscriptionId: subscription.id || '',
            stripeCustomerId: getCustomerId(subscription.customer),
            subscriptionStatus: subscription.status || '',
            cancelAtPeriodEnd: false,
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    )

    console.log(`User ${uid} downgraded to free`)
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed')
    }

    const signature = req.headers['stripe-signature']

    let event
    let rawBody

    try {
        const stripe = getStripe()
        rawBody = await getRawBody(req)

        event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        )
    } catch (error) {
        const isLocalTest = process.env.NODE_ENV !== 'production'

        if (!isLocalTest) {
            console.error('Webhook signature verification failed:', error.message)
            return res.status(400).send(`Webhook Error: ${error.message}`)
        }

        try {
            event = parseEventForLocalTest(req, rawBody)
            console.warn(`Local webhook signature skipped: ${event.type}`)
        } catch (parseError) {
            console.error('Webhook parse failed:', parseError.message)
            return res.status(400).send(`Webhook Error: ${parseError.message}`)
        }
    }

    const handledEvents = [
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    ]

    if (!handledEvents.includes(event.type)) {
        return res.status(200).json({
            received: true,
            ignored: event.type,
        })
    }

    try {
        const stripe = getStripe()

        rawBody = await getRawBody(req)

        if (!signature) {
            return res
                .status(400)
                .send('Webhook Error: stripe-signature header is missing')
        }

        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            return res
                .status(500)
                .send('Webhook Error: STRIPE_WEBHOOK_SECRET is missing')
        }

        event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        )
    } catch (error) {
        console.error('Webhook verification failed:', error.message)

        return res.status(400).send(`Webhook Error: ${error.message}`)
    }
}