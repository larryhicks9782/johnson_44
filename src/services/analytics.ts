// src/services/analytics.ts - Firebase Analytics & Crash Reporting Setup
import { initializeAnalytics, logEvent, setUserId } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { app } from "./firebase";

// Initialize Analytics
export const analytics = initializeAnalytics(app);

// Initialize App Check (security)
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("YOUR_RECAPTCHA_V3_KEY"),
  isTokenAutoRefreshEnabled: true
});

/**
 * Track user identity for analytics
 */
export const trackUser = (userId: string, userName: string, userEmail: string) => {
  try {
    setUserId(analytics, userId);
    logEvent(analytics, "user_login", {
      user_name: userName,
      user_email: userEmail,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error tracking user:", err);
  }
};

/**
 * Track when user discovers a gathering
 */
export const trackGatheringView = (gatheringId: string, category: string) => {
  logEvent(analytics, "gathering_viewed", {
    gathering_id: gatheringId,
    category: category,
    timestamp: new Date().toISOString()
  });
};

/**
 * Track RSVP actions
 */
export const trackRSVP = (gatheringId: string, status: "attending" | "maybe" | "not_attending") => {
  logEvent(analytics, "gathering_rsvp", {
    gathering_id: gatheringId,
    rsvp_status: status,
    timestamp: new Date().toISOString()
  });
};

/**
 * Track gathering creation
 */
export const trackGatheringCreated = (category: string, capacity: number) => {
  logEvent(analytics, "gathering_created", {
    category: category,
    capacity: capacity,
    timestamp: new Date().toISOString()
  });
};

/**
 * Track QR code scans
 */
export const trackQRScan = (gatheringId: string, source: string) => {
  logEvent(analytics, "qr_code_scanned", {
    gathering_id: gatheringId,
    source: source,
    timestamp: new Date().toISOString()
  });
};

/**
 * Track feature usage
 */
export const trackFeatureUsed = (featureName: string, metadata?: Record<string, any>) => {
  logEvent(analytics, "feature_used", {
    feature_name: featureName,
    ...metadata,
    timestamp: new Date().toISOString()
  });
};

/**
 * Report errors to Crashlytics (would need additional setup)
 * Note: Firebase Crashlytics requires additional configuration in Android/iOS
 */
export const reportError = (error: Error, context?: string) => {
  console.error(`Error Report [${context}]:`, error);
  // In production, send to Crashlytics or error tracking service
};

export default {
  trackUser,
  trackGatheringView,
  trackRSVP,
  trackGatheringCreated,
  trackQRScan,
  trackFeatureUsed,
  reportError
};
