// Firebase Cloud Messaging for push notifications
// This sends silent push notifications to wake up driver apps

let admin = null;

const initializeFirebase = () => {
  try {
    // Check if Firebase credentials are configured
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
      console.log('⚠️ Firebase not configured - push notifications disabled');
      return false;
    }

    const firebaseAdmin = require('firebase-admin');
    const credentials = JSON.parse(serviceAccount);
    
    admin = firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(credentials),
    });
    
    console.log('✅ Firebase initialized for push notifications');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return false;
  }
};

// Send location request to specific driver
const sendLocationRequest = async (fcmToken) => {
  if (!admin) return false;
  
  try {
    const message = {
      token: fcmToken,
      data: {
        type: 'LOCATION_REQUEST',
        timestamp: Date.now().toString(),
      },
      android: {
        priority: 'high',
        ttl: 30000, // 30 seconds
      },
    };

    await admin.messaging().send(message);
    console.log('📍 Location request sent to driver');
    return true;
  } catch (error) {
    console.error('Failed to send FCM:', error.message);
    return false;
  }
};

// Send location request to all drivers
const sendLocationRequestToAll = async (fcmTokens) => {
  if (!admin || !fcmTokens || fcmTokens.length === 0) {
    console.log('📍 No FCM tokens to send to');
    return null;
  }
  
  try {
    console.log(`📍 Sending FCM to ${fcmTokens.length} tokens...`);
    console.log(`📍 First token preview: ${fcmTokens[0]?.substring(0, 30)}...`);
    
    // Use sendEachForMulticast with proper structure
    const message = {
      tokens: fcmTokens,
      data: {
        type: 'LOCATION_REQUEST',
        timestamp: Date.now().toString(),
      },
      android: {
        priority: 'high',
        ttl: 30 * 1000, // 30 seconds in milliseconds
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`📍 FCM Result: ${response.successCount} success, ${response.failureCount} failed`);
    
    // Log any failures for debugging
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.log(`📍 FCM failed for token ${idx}: ${resp.error?.message}`);
        }
      });
    }
    
    return response;
  } catch (error) {
    console.error('❌ Failed to send FCM to all:', error.message);
    console.error('❌ Full error:', error);
    return null;
  }
};

module.exports = {
  initializeFirebase,
  sendLocationRequest,
  sendLocationRequestToAll,
};
