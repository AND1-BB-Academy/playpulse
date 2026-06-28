import dotenv from 'dotenv'
import Stripe from 'stripe'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: '.env.local' })

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }

  try {
    const { uid } = req.body || {}

    if (!uid) {
      return res.status(400).json({
        error: 'uid is missing',
      })
    }

    const db = getFirestoreDb()
    const userRef = db.collection('users').doc(uid)
    const userSnap = await userRef.get()

    if (!userSnap.exists) {
      return res.status(404).json({
        error: 'User not found',
      })
    }

    const userData = userSnap.data()
    const stripeCustomerId = userData?.stripeCustomerId

    if (!stripeCustomerId) {
      return res.status(400).json({
        error: 'Stripe customer ID is missing',
      })
    }

    const origin = req.headers.origin || 'http://localhost:3000'
    const stripe = getStripe()

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: origin,
    })

    return res.status(200).json({
      url: portalSession.url,
    })
  } catch (error) {
    console.error('Create portal session failed:', error)

    return res.status(500).json({
      error: error.message || 'Failed to create portal session',
    })
  }
}