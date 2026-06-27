import dotenv from 'dotenv'
import Stripe from 'stripe'

dotenv.config({ path: '.env.local' })

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
        })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const stripePriceId = process.env.STRIPE_PRICE_ID

    if (!stripeSecretKey) {
        return res.status(500).json({
            error: 'STRIPE_SECRET_KEY is missing',
        })
    }

    if (!stripePriceId) {
        return res.status(500).json({
            error: 'STRIPE_PRICE_ID is missing',
        })
    }

    const stripe = new Stripe(stripeSecretKey)

    try {
        const { uid, email } = req.body || {}

        if (!uid || !email) {
            return res.status(400).json({
                error: 'Missing user information',
            })
        }

        const origin = req.headers.origin || 'http://localhost:3000'

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: email,
            client_reference_id: uid,
            line_items: [
                {
                    price: stripePriceId,
                    quantity: 1,
                },
            ],
            metadata: {
                uid,
                firebaseUid: uid,
            },
            subscription_data: {
                metadata: {
                    uid,
                    firebaseUid: uid,
                },
            },
            success_url: `${origin}/?checkout=success`,
            cancel_url: `${origin}/?checkout=cancel`,
        })

        return res.status(200).json({
            url: session.url,
        })
    } catch (error) {
        console.error('Stripe checkout session error:', error)

        return res.status(500).json({
            error: error.message || 'Failed to create checkout session',
        })
    }
}