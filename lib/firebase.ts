"use client"

import { initializeApp, getApps } from "firebase/app"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAN9ORHaui8p1QqeWikBdrd1wQGRQsWcGc",
  authDomain: "travelplanner-dd3b5.firebaseapp.com",
  projectId: "travelplanner-dd3b5",
  storageBucket: "travelplanner-dd3b5.firebasestorage.app",
  messagingSenderId: "470892635372",
  appId: "1:470892635372:web:2d91e700b802c427c4f1c9",
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const db = getFirestore(app)
