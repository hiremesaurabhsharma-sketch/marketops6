import firebaseConfig from './firebase-applet-config.json';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Cache the access token in memory
let cachedAccessToken = null;
let isSigningIn = false;

// Google Auth Provider setup with Workspace Scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');

// Clean Base64URL encoding helper
function base64UrlEncode(str) {
  const b64 = btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode(parseInt(p1, 16));
  }));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Error logger as forced by SKILL.md
const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Floating UI Structure Creation ---
function initWorkspaceHub() {
  // Styles for the Hub Dialog & Toggle Button
  const hubStyles = `
    /* Floating Workspace Launcher */
    .workspace-launcher {
      position: fixed;
      bottom: 2rem;
      left: 2rem;
      background: rgba(10, 15, 12, 0.75);
      border: 1px solid rgba(0, 229, 255, 0.25);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: var(--accent-cyan);
      width: 56px;
      height: 56px;
      border-radius: 50%;
      box-shadow: 0 8px 24px rgba(0, 229, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9998;
      cursor: pointer;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.3s ease, box-shadow 0.3s ease;
    }
    .workspace-launcher:hover {
      border-color: var(--accent-cyan);
      transform: scale(1.1) translateY(-2px);
      box-shadow: 0 12px 30px rgba(0, 229, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .workspace-launcher svg {
      width: 26px;
      height: 26px;
    }
    .workspace-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--accent-cyan);
      color: #010403;
      font-size: 0.65rem;
      font-weight: 800;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
    }

    /* Workspace Modal Backdrop */
    .workspace-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(1, 4, 3, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .workspace-modal-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }

    /* Workspace Glass Container */
    .workspace-container {
      background: rgba(10, 15, 12, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 28px;
      width: 90%;
      max-width: 580px;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 24px 60px rgba(0,0,0,0.8), 0 0 60px rgba(0, 229, 255, 0.05);
      transform: scale(0.92);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.15);
      padding: 2rem;
      color: #fff;
    }
    .workspace-modal-backdrop.active .workspace-container {
      transform: scale(1);
    }

    /* Tabs buttons */
    .hub-tabs {
      display: flex;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      margin-bottom: 1.5rem;
      gap: 1rem;
    }
    .hub-tab-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 0.95rem;
      font-weight: 600;
      padding: 0.75rem 0.25rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.25s ease;
    }
    .hub-tab-btn:hover {
      color: #fff;
    }
    .hub-tab-btn.active {
      color: var(--accent-cyan);
      border-color: var(--accent-cyan);
    }

    /* Standard Google Authentication Official Style button */
    .gsi-button {
      background-color: white;
      border: 1px solid #747775;
      border-radius: 12px;
      box-sizing: border-box;
      color: #1f1f1f;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      font-weight: 600;
      height: 48px;
      padding: 0 1.5rem;
      width: 100%;
      transition: background-color .218s, border-color .218s, box-shadow .218s;
      gap: 0.75rem;
    }
    .gsi-button:hover {
      background-color: #f2f2f2;
      border-color: #747775;
      box-shadow: 0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15);
    }
    .gsi-button svg {
      width: 20px;
      height: 20px;
    }

    /* Details panel */
    .user-profile-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.05);
      padding: 1rem;
      border-radius: 18px;
      margin-bottom: 1.5rem;
    }
    .user-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid var(--accent-cyan);
    }
    .user-meta h4 {
      font-family: var(--font-display);
      font-weight: 700;
      margin: 0;
      font-size: 1rem;
    }
    .user-meta p {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 0;
    }

    /* Scrollable records lists */
    .record-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .record-item {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 1rem;
      position: relative;
      transition: border-color 0.25s ease;
    }
    .record-item:hover {
      border-color: rgba(0, 229, 255, 0.15);
    }
    .record-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 0.25rem;
    }
    .record-subtitle {
      font-size: 0.8rem;
      color: var(--accent-cyan);
      margin-bottom: 0.5rem;
    }
    .record-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .record-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Close Button */
    .modal-close-btn {
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      background: rgba(255,255,255,0.05);
      border: none;
      color: var(--text-muted);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.25s, background 0.25s;
    }
    .modal-close-btn:hover {
      background: rgba(255,255,255,0.12);
      color: #fff;
    }

    /* Email sending form */
    .email-form {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.04);
      padding: 1rem;
      border-radius: 18px;
      margin-top: 1rem;
    }
    .email-form-group {
      margin-bottom: 0.75rem;
    }

    /* Form controller */
    .email-control {
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      color: #fff;
      padding: 0.6rem;
      font-size: 0.85rem;
      width: 100%;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .email-control:focus {
      border-color: var(--accent-cyan);
    }

    /* Traditional Auth form components */
    .hub-auth-form {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      text-align: left;
      margin-top: 1rem;
    }
    .hub-auth-input-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .hub-auth-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
    }
    .hub-auth-input {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #fff;
      padding: 0.75rem 1rem;
      font-size: 0.9rem;
      outline: none;
      box-sizing: border-box;
      width: 100%;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .hub-auth-input:focus {
      border-color: var(--accent-cyan);
      box-shadow: 0 0 10px rgba(0, 229, 255, 0.15);
    }
    .hub-auth-btn {
      background: var(--accent-cyan);
      color: #010403;
      border: none;
      border-radius: 12px;
      padding: 0.85rem 1rem;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
      transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
      text-align: center;
    }
    .hub-auth-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 229, 255, 0.2);
    }
    .hub-auth-toggle-link {
      font-size: 0.8rem;
      color: var(--accent-cyan);
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      font-weight: 600;
      text-decoration: none;
      display: inline-block;
      transition: color 0.15s;
    }
    .hub-auth-toggle-link:hover {
      color: #fff;
      text-decoration: underline;
    }
    .hub-auth-error {
      background: rgba(255, 77, 77, 0.08);
      border: 1px solid rgba(255, 77, 77, 0.25);
      color: #ff4d4d;
      font-size: 0.85rem;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
      display: none;
      line-height: 1.4;
    }
    .hub-auth-success {
      background: rgba(0, 245, 132, 0.08);
      border: 1px solid rgba(0, 245, 132, 0.25);
      color: var(--accent-green);
      font-size: 0.85rem;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
      display: none;
      line-height: 1.4;
    }
    .hub-auth-divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 1.25rem 0;
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .hub-auth-divider::before, .hub-auth-divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .hub-auth-divider::before {
      margin-right: .75em;
    }
    .hub-auth-divider::after {
      margin-left: .75em;
    }

    @media (max-width: 580px) {
      .workspace-launcher {
        bottom: 1.5rem;
        left: 1.5rem;
        width: 50px;
        height: 50px;
      }
      .workspace-container {
        padding: 1.25rem;
      }
    }
  `;

  // Inject Styles
  const styleEl = document.createElement('style');
  styleEl.textContent = hubStyles;
  document.head.appendChild(styleEl);

  // Create Floating Launcher Badge Button
  const launcher = document.createElement('div');
  launcher.className = 'workspace-launcher';
  launcher.id = 'workspace-launcher';
  launcher.setAttribute('aria-label', 'Open MarketOps Workspace Hub');
  launcher.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" class="lucide lucide-briefcase" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 2H9a2 2 0 0 0-2 2v2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4V4a2 2 0 0 0-2-2z"/>
      <path d="M7 6h10"/>
      <path d="M3 11h18"/>
    </svg>
    <div class="workspace-badge" id="hub-badge" style="display:none;">!</div>
  `;
  document.body.appendChild(launcher);

  // Create Modal Backdrop Layout
  const backdrop = document.createElement('div');
  backdrop.className = 'workspace-modal-backdrop';
  backdrop.id = 'workspace-hub-modal';
  backdrop.innerHTML = `
    <div class="workspace-container" style="position:relative;">
      <button class="modal-close-btn" id="close-workspace-hub">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <!-- Welcome panel -->
      <div style="margin-bottom: 1.5rem;">
        <span style="color:var(--accent-cyan); font-weight:700; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.15em; display:block; margin-bottom:0.25rem;">MarketOps Enterprise Connections</span>
        <h3 style="font-family:var(--font-display); font-weight:800; font-size:1.6rem; color:#fff; display:flex; align-items:center; gap:0.5rem; margin:0;">
          Workspace Partner Hub
        </h3>
      </div>

      <!-- User Auth State Switcher -->
      <div id="hub-auth-section">
        <!-- Will show Login screen or Logged-in profile -->
      </div>

      <!-- Tabbed container (hidden if not logged in) -->
      <div id="hub-content-section" style="display:none;">
        <div class="hub-tabs">
          <button class="hub-tab-btn active" id="tab-gmail">Gmail Integration</button>
          <button class="hub-tab-btn" id="tab-firestore">My RPF/Audit Logs</button>
        </div>

        <!-- Tab Content 1: Gmail Integration -->
        <div id="panel-gmail">
          <p class="why-desc" style="font-size:0.85rem; margin-bottom:1rem;">Your browser is securely linked using the **Gmail API** scopes configured on Google Cloud.</p>
          
          <h4 style="font-size:0.9rem; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center;">
            <span>Recent Inbox Messages</span>
            <button id="refresh-gmail" style="background:none; border:none; color:var(--accent-cyan); cursor:pointer; font-size:0.75rem;"><i data-lucide="rotate-cw" style="width:12px; display:inline;"></i> Sync Inbox</button>
          </h4>
          <div class="record-list" id="gmail-messages-list">
            <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Syncing actual inbox threads with permission...</div>
          </div>

          <!-- Send mail on behalf -->
          <div class="email-form">
            <h4 style="font-size:0.9rem; font-weight:700; color:#fff; margin-bottom:0.5rem;"><i data-lucide="send" style="width:14px; display:inline-block; vertical-align:middle;"></i> Send RFP via your Gmail</h4>
            <div class="email-form-group">
              <input type="email" id="email-to" class="email-control" placeholder="Recipient (default: connect@marketops.in)" />
            </div>
            <div class="email-form-group">
              <input type="text" id="email-subject" class="email-control" placeholder="Subject" />
            </div>
            <div class="email-form-group">
              <textarea id="email-body" class="email-control" rows="3" placeholder="Message content..."></textarea>
            </div>
            <button id="send-gmail-btn" class="btn btn-primary" style="width:100%; border-radius:10px; padding:0.6rem; font-size:0.85rem;">Send Email Securely</button>
          </div>
        </div>

        <!-- Tab Content 2: Firestore Logs -->
        <div id="panel-firestore" style="display:none;">
          <p class="why-desc" style="font-size:0.85rem; margin-bottom:1rem;">Real-time tracking of requests submitted from this account. Fully verified by Firestore security policies.</p>
          <div class="record-list" id="firestore-inquiries-list">
            <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Loading secured Firestore queries...</div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  // --- Wire UI Interaction Actions ---
  const modalToggle = () => backdrop.classList.toggle('active');
  launcher.addEventListener('click', modalToggle);
  document.getElementById('close-workspace-hub').addEventListener('click', modalToggle);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) modalToggle();
  });

  // Wire Tab Buttons
  const tabGmail = document.getElementById('tab-gmail');
  const tabFirestore = document.getElementById('tab-firestore');
  const panelGmail = document.getElementById('panel-gmail');
  const panelFirestore = document.getElementById('panel-firestore');

  tabGmail.addEventListener('click', () => {
    tabGmail.classList.add('active');
    tabFirestore.classList.remove('active');
    panelGmail.style.display = 'block';
    panelFirestore.style.display = 'none';
  });

  tabFirestore.addEventListener('click', () => {
    tabFirestore.classList.add('active');
    tabGmail.classList.remove('active');
    panelGmail.style.display = 'none';
    panelFirestore.style.display = 'block';
    loadFirestoreInquiries();
  });

  let authViewMode = 'signin'; // 'signin', 'signup', 'forgot'

  function renderAuthForm() {
    const authSection = document.getElementById('hub-auth-section');
    if (!authSection) return;

    if (auth.currentUser) {
      return; // Already logged in, nothing to render
    }

    let formHtml = '';

    if (authViewMode === 'forgot') {
      formHtml = `
        <div style="padding: 0.5rem 0;">
          <p class="why-desc" style="font-size:0.85rem; margin-bottom:1rem; line-height:1.5; color:rgba(255,255,255,0.7);">Enter your email below. We will securely dispatch a confidential password reset link to your mailbox.</p>
          <div class="hub-auth-error" id="hub-auth-error-block"></div>
          <div class="hub-auth-success" id="hub-auth-success-block"></div>
          
          <form class="hub-auth-form" id="hub-forgot-form">
            <div class="hub-auth-input-group">
              <label class="hub-auth-label" for="forgot-email">Email Address</label>
              <input type="email" id="forgot-email" class="hub-auth-input" placeholder="name@company.com" required autocomplete="email" />
            </div>
            <button type="submit" class="hub-auth-btn" id="forgot-submit-btn">Send Reset Link</button>
          </form>

          <p style="font-size:0.8rem; margin-top:1.25rem; text-align:center; color:var(--text-muted); line-height:1.4;">
            Remembered your password? <button class="hub-auth-toggle-link" id="go-to-signin">Sign In</button>
          </p>
        </div>
      `;
    } else if (authViewMode === 'signup') {
      formHtml = `
        <div style="padding: 0.5rem 0;">
          <p class="why-desc" style="font-size:0.85rem; margin-bottom:1rem; line-height:1.5; color:rgba(255,255,255,0.7);">Create a secure partner account to log your on-demand inquiries and track digital metrics in real-time.</p>
          <div class="hub-auth-error" id="hub-auth-error-block"></div>
          <div class="hub-auth-success" id="hub-auth-success-block"></div>

          <form class="hub-auth-form" id="hub-signup-form">
            <div class="hub-auth-input-group">
              <label class="hub-auth-label" for="signup-name">Full Name</label>
              <input type="text" id="signup-name" class="hub-auth-input" placeholder="Gaurav Singh" required autocomplete="name" />
            </div>
            <div class="hub-auth-input-group">
              <label class="hub-auth-label" for="signup-email">Email Address</label>
              <input type="email" id="signup-email" class="hub-auth-input" placeholder="name@company.com" required autocomplete="email" />
            </div>
            <div class="hub-auth-input-group">
              <label class="hub-auth-label" for="signup-password">Choose Password</label>
              <input type="password" id="signup-password" class="hub-auth-input" placeholder="••••••••" required autocomplete="new-password" minlength="6" />
            </div>
            <button type="submit" class="hub-auth-btn" id="signup-submit-btn">Register Secure Account</button>
          </form>

          <div class="hub-auth-divider">Or use workspace provider</div>

          <button class="gsi-button" id="hub-login-btn">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>Sign in with Google</span>
          </button>

          <p style="font-size:0.8rem; margin-top:1.5rem; text-align:center; color:var(--text-muted); line-height:1.4;">
            Existing partner? <button class="hub-auth-toggle-link" id="go-to-signin">Sign In Here</button>
          </p>
        </div>
      `;
    } else {
      // Default: Sign In
      formHtml = `
        <div style="padding: 0.5rem 0;">
          <p class="why-desc" style="font-size:0.85rem; margin-bottom:1rem; line-height:1.5; color:rgba(255,255,255,0.7);">To enable security-hardened **Firebase Firestore** tracking and access your **Workspace Gmail** inbox directly inside this dashboard, authenticate below.</p>
          <div class="hub-auth-error" id="hub-auth-error-block"></div>
          <div class="hub-auth-success" id="hub-auth-success-block"></div>

          <form class="hub-auth-form" id="hub-signin-form">
            <div class="hub-auth-input-group">
              <label class="hub-auth-label" for="signin-email">Email Address</label>
              <input type="email" id="signin-email" class="hub-auth-input" placeholder="name@company.com" required autocomplete="email" />
            </div>
            <div class="hub-auth-input-group">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label class="hub-auth-label" for="signin-password">Password</label>
                <button type="button" class="hub-auth-toggle-link" id="go-to-forgot" style="font-size:0.75rem;">Forgot Password?</button>
              </div>
              <input type="password" id="signin-password" class="hub-auth-input" placeholder="••••••••" required autocomplete="current-password" />
            </div>
            <button type="submit" class="hub-auth-btn" id="signin-submit-btn">Sign In Securely</button>
          </form>

          <div class="hub-auth-divider">Or use workspace provider</div>

          <button class="gsi-button" id="hub-login-btn">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>Sign in with Google</span>
          </button>

          <p style="font-size:0.8rem; margin-top:1.5rem; text-align:center; color:var(--text-muted); line-height:1.4;">
            New partner? <button class="hub-auth-toggle-link" id="go-to-signup">Register Account</button>
          </p>
        </div>
      `;
    }

    authSection.innerHTML = formHtml;
    bindAuthUiEvents();
  }

  function bindAuthUiEvents() {
    // Nav toggles
    const toSignin = document.getElementById('go-to-signin');
    if (toSignin) {
      toSignin.addEventListener('click', (e) => {
        e.preventDefault();
        authViewMode = 'signin';
        renderAuthForm();
      });
    }

    const toSignup = document.getElementById('go-to-signup');
    if (toSignup) {
      toSignup.addEventListener('click', (e) => {
        e.preventDefault();
        authViewMode = 'signup';
        renderAuthForm();
      });
    }

    const toForgot = document.getElementById('go-to-forgot');
    if (toForgot) {
      toForgot.addEventListener('click', (e) => {
        e.preventDefault();
        authViewMode = 'forgot';
        renderAuthForm();
      });
    }

    // Google Sign in Event
    const loginBtn = document.getElementById('hub-login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        if (isSigningIn) return;
        isSigningIn = true;
        const errorBlock = document.getElementById('hub-auth-error-block');
        if (errorBlock) errorBlock.style.display = 'none';

        try {
          const result = await signInWithPopup(auth, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          cachedAccessToken = credential?.accessToken;
          console.log('Firebase and Google workspace setup approved.');
        } catch (err) {
          console.error('Google Sign-In connection failed:', err);
          if (errorBlock) {
             errorBlock.textContent = `Google Sign-In failed or was cancelled.`;
             errorBlock.style.display = 'block';
          }
        } finally {
          isSigningIn = false;
        }
      });
    }

    // Traditional Sign In Submit
    const signinForm = document.getElementById('hub-signin-form');
    if (signinForm) {
      signinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;
        const submitBtn = document.getElementById('signin-submit-btn');
        const errorBlock = document.getElementById('hub-auth-error-block');

        if (errorBlock) errorBlock.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying credentials...';

        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
          console.error('Email sign in failure:', err);
          if (errorBlock) {
            let userFriendlyMsg = err.message;
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
              userFriendlyMsg = 'Invalid email address or key coordinates. Please verify your details.';
            } else if (err.code === 'auth/invalid-email') {
              userFriendlyMsg = 'The email address format is invalid.';
            }
            errorBlock.textContent = userFriendlyMsg;
            errorBlock.style.display = 'block';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In Securely';
          }
        }
      });
    }

    // Traditional Sign Up Submit
    const signupForm = document.getElementById('hub-signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const submitBtn = document.getElementById('signup-submit-btn');
        const errorBlock = document.getElementById('hub-auth-error-block');
        const successBlock = document.getElementById('hub-auth-success-block');

        if (errorBlock) errorBlock.style.display = 'none';
        if (successBlock) successBlock.style.display = 'none';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering coordinates...';

        try {
          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(userCred.user, { displayName: name });
          if (successBlock) {
            successBlock.textContent = 'Secure Account registered! Welcome to the Partner workspace.';
            successBlock.style.display = 'block';
          }
        } catch (err) {
          console.error('Email sign up failure:', err);
          if (errorBlock) {
            let userFriendlyMsg = err.message;
            if (err.code === 'auth/email-already-in-use') {
              userFriendlyMsg = 'This email coordinate is already associated with an account.';
            } else if (err.code === 'auth/weak-password') {
              userFriendlyMsg = 'The chosen key is too weak. Must be at least 6 characters.';
            }
            errorBlock.textContent = userFriendlyMsg;
            errorBlock.style.display = 'block';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register Secure Account';
          }
        }
      });
    }

    // Traditional Forgot Password Submit
    const forgotForm = document.getElementById('hub-forgot-form');
    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim();
        const submitBtn = document.getElementById('forgot-submit-btn');
        const errorBlock = document.getElementById('hub-auth-error-block');
        const successBlock = document.getElementById('hub-auth-success-block');

        if (errorBlock) errorBlock.style.display = 'none';
        if (successBlock) successBlock.style.display = 'none';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Dispatching link...';

        try {
          await sendPasswordResetEmail(auth, email);
          if (successBlock) {
            successBlock.textContent = 'A secure password recovery hyperlink has been transmitted. Check your spam if not received within 1 minute.';
            successBlock.style.display = 'block';
          }
          document.getElementById('forgot-email').value = '';
        } catch (err) {
          console.error('Forgot password link failure:', err);
          if (errorBlock) {
            let userFriendlyMsg = err.message;
            if (err.code === 'auth/user-not-found') {
              userFriendlyMsg = 'No registered partner matches this email address.';
            }
            errorBlock.textContent = userFriendlyMsg;
            errorBlock.style.display = 'block';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
          }
        }
      });
    }
  }

  // Track state changes
  onAuthStateChanged(auth, async (user) => {
    const authSection = document.getElementById('hub-auth-section');
    const contentSection = document.getElementById('hub-content-section');
    const badge = document.getElementById('hub-badge');

    if (user) {
      badge.style.display = 'none';
      contentSection.style.display = 'block';
      authSection.innerHTML = `
        <div class="user-profile-row">
          <img src="${user.photoURL || 'https://lh3.googleusercontent.com/a/default-user'}" class="user-avatar" alt="Avatar" />
          <div class="user-meta" style="flex-grow:1;">
            <h4>${user.displayName || 'Authorized Partner'}</h4>
            <p>${user.email}</p>
          </div>
          <button id="hub-logout-btn" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:0.8rem; font-weight:700;"><i data-lucide="log-out" style="width:14px; display:inline;"></i> Sign Out</button>
        </div>
      `;

      // Wire logout
      document.getElementById('hub-logout-btn').addEventListener('click', async () => {
        if (confirm('Sign out of your MarketOps partner dashboard?')) {
          await signOut(auth);
          cachedAccessToken = null;
        }
      });

      // Hook contact form if on contact page!
      attachContactFormOverride();

      // Trigger standard Lucide refresh
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // Load initial Gmail / Firestore data
      loadGmailInbox();
    } else {
      badge.style.display = 'flex';
      contentSection.style.display = 'none';
      renderAuthForm();
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  });

  // Wire Refresh
  document.getElementById('refresh-gmail').addEventListener('click', loadGmailInbox);

  // Wire RFP Send Button
  document.getElementById('send-gmail-btn').addEventListener('click', sendGmailMessage);
}

// --- Gmail: Load Recent Inbox Messages ---
async function loadGmailInbox() {
  const listContainer = document.getElementById('gmail-messages-list');
  if (!listContainer) return;

  if (!cachedAccessToken) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding:1.25rem; color:var(--text-muted); font-size:0.85rem; line-height:1.5;">
        <p>Direct Gmail syncing requires authenticating using the Google Cloud workspace provider link.</p>
        <p style="font-size:0.75rem; margin-top:0.55rem; color:var(--accent-cyan); font-weight:500;">Email/Password auth is perfect for secure Cloud Firestore RFP Logging!</p>
      </div>`;
    return;
  }

  listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;"><i data-lucide="loader" class="animate-spin" style="width:14px; display:inline-block; margin-right:6px;"></i> Reading mailbox in real-time...</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  try {
    const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=4', {
      headers: { 'Authorization': `Bearer ${cachedAccessToken}` }
    });

    if (!listRes.ok) {
      throw new Error(`Gmail API Returned ${listRes.status}`);
    }

    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) {
      listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Sandbox mailbox is clean (No messages found).</div>`;
      return;
    }

    // Load full details for top 4 threads
    const detailPromises = listData.messages.map(async (msg) => {
      const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
        headers: { 'Authorization': `Bearer ${cachedAccessToken}` }
      });
      return await detailRes.json();
    });

    const detailedMsgs = await Promise.all(detailPromises);
    listContainer.innerHTML = '';

    detailedMsgs.forEach(msg => {
      const headers = msg.payload?.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Contact';
      const dateRaw = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
      const formattedDate = dateRaw ? new Date(dateRaw).toLocaleDateString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
      const snippet = msg.snippet ? decodeHtmlEntities(msg.snippet) : 'Clean body string.';

      const card = document.createElement('div');
      card.className = 'record-item';
      card.innerHTML = `
        <div class="record-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${subject}</div>
        <div class="record-subtitle" style="font-size:0.75rem;"><span style="color:var(--text-muted);">From:</span> ${from}</div>
        <div class="record-desc" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${snippet}</div>
        <div class="record-meta">
          <span>${formattedDate}</span>
          <span style="color:var(--accent-cyan); font-weight:800; font-size:0.65rem; background:rgba(0,229,255,0.05); padding:2px 8px; border-radius:8px;">Gmail API</span>
        </div>
      `;
      listContainer.appendChild(card);
    });

  } catch (err) {
    console.error('Gmail loading error:', err);
    listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:#ff4d4d; font-size:0.85rem;"><i data-lucide="alert-triangle" style="width:14px; display:inline;"></i> Google OAuth Token expired or insufficient privileges to fetch.</div>`;
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Helper to decode escaped html from snippet
function decodeHtmlEntities(text) {
  const txt = document.createElement("textarea");
  txt.innerHTML = text;
  return txt.value;
}

// --- Gmail: Send Real Message on Behalf ---
async function sendGmailMessage() {
  if (!cachedAccessToken) {
    alert('This account is authenticated under independent Email/Password coordinates. To utilize the direct Gmail API forwarding engine, please sign out and authenticate using the Google workspace link.');
    return;
  }

  const toInput = document.getElementById('email-to');
  const subjectInput = document.getElementById('email-subject');
  const bodyInput = document.getElementById('email-body');

  const rawTo = toInput.value.trim() || 'connect@marketops.in';
  const subject = subjectInput.value.trim();
  const body = bodyInput.value.trim();

  if (!subject || !body) {
    alert('Please provide a subject and a body for your message.');
    return;
  }

  // Mandatory scope permission check
  const confirmResult = confirm(`Confirm Sending Email:\n\nTo: ${rawTo}\nSubject: ${subject}\n\nThis message will be sent securely from your Google Workspace Gmail account.`);
  if (!confirmResult) return;

  const sendBtn = document.getElementById('send-gmail-btn');
  sendBtn.disabled = true;
  sendBtn.innerHTML = `Sending...`;

  try {
    const rawEmailContent = [
      'To: ' + rawTo,
      'Subject: ' + subject,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body.replace(/\n/g, '<br />')
    ].join('\r\n');

    const encodedRaw = base64UrlEncode(rawEmailContent);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cachedAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedRaw })
    });

    if (!res.ok) {
      const errRes = await res.json();
      throw new Error(errRes.error?.message || `Gmail API returned ${res.status}`);
    }

    alert('Email successfully dispatched via Gmail API!');
    subjectInput.value = '';
    bodyInput.value = '';
    loadGmailInbox(); // Reload the inbox list
  } catch (err) {
    console.error('Mail dispatch failure:', err);
    alert(`Mail dispatch failed: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `Send Email Securely`;
  }
}

// --- Firestore: Fetch inquiries submitted by currently authenticated user ---
async function loadFirestoreInquiries() {
  const listContainer = document.getElementById('firestore-inquiries-list');
  if (!listContainer) return;

  listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;"><i data-lucide="loader" class="animate-spin" style="width:14px; display:inline-block; margin-right:6px;"></i> Querying database...</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const user = auth.currentUser;
  if (!user) {
    listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Authorize your account to view submitted logs.</div>`;
    return;
  }

  try {
    const q = query(
      collection(db, 'inquiries'),
      where('userId', '==', user.uid)
    );

    const querySnapshot = await getDocs(q);
    listContainer.innerHTML = '';

    if (querySnapshot.empty) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">
          No active inquiries compiled on this account.<br />
          <span style="font-size:0.75rem; color:var(--accent-cyan); display:block; margin-top:0.5rem;">Use the Secure Onboarding Form on the Contact page to register real-time entries.</span>
        </div>
      `;
      return;
    }

    const inquiriesList = [];
    querySnapshot.forEach(docSnap => {
      inquiriesList.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Client-side sort if Firestore index isn't pre-built
    inquiriesList.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA;
    });

    inquiriesList.forEach(item => {
      const card = document.createElement('div');
      card.className = 'record-item';
      
      const rawDate = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
      const displayDate = rawDate.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
          <div class="record-title">${item.businessName || 'Business Record'}</div>
          <button class="delete-inquiry-btn" data-id="${item.id}" style="background:none; border:none; color:#ff4d4d; cursor:pointer;" aria-label="Delete RFP"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
        </div>
        <div class="record-subtitle" style="font-size:0.75rem;"><span style="color:var(--text-muted); font-weight:400;">Service Focus:</span> ${item.service}</div>
        <div class="record-desc">
          <p style="margin:2px 0;"><span style="color:#fff;">Budgets:</span> ${item.monthlyBudget}</p>
          <p style="margin:2px 0;"><span style="color:#fff;">Contact:</span> ${item.name} (${item.phone})</p>
          ${item.message ? `<p style="margin:4px 0 2px 0; color:rgba(255,255,255,0.7); font-style:italic; font-size:0.8rem;">"${item.message}"</p>` : ''}
        </div>
        <div class="record-meta">
          <span>${displayDate}</span>
          <span style="color:var(--accent-green); font-weight:800; font-size:0.65rem; background:rgba(0,245,132,0.05); padding:2px 8px; border-radius:8px;">Firestore db</span>
        </div>
      `;
      listContainer.appendChild(card);
    });

    // Wire deletes
    const deleteBtns = listContainer.querySelectorAll('.delete-inquiry-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const inquiryId = btn.getAttribute('data-id');
        const confirmResult = confirm('Are you sure you want to securely remove this RFP entry from the database? This action cannot be undone.');
        if (!confirmResult) return;

        try {
          await deleteDoc(doc(db, 'inquiries', inquiryId));
          loadFirestoreInquiries();
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `inquiries/${inquiryId}`);
          alert('Failed to delete query. Insufficient database policies.');
        }
      });
    });

  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'inquiries');
    listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:#ff4d4d; font-size:0.85rem;">Access Denied. Ensure standard Firestore secure policies remain intact.</div>`;
  }
}

// --- Contact Form Integration ---
function attachContactFormOverride() {
  const form = document.querySelector('.contact-form-glass form');
  if (!form) return;

  // Let's prefill fields if logged in to save time!
  const user = auth.currentUser;
  if (user) {
    const nameInput = form.querySelector('input[name="name"]');
    const emailInput = form.querySelector('input[name="email"]');
    if (nameInput && !nameInput.value) nameInput.value = user.displayName || '';
    if (emailInput && !emailInput.value) emailInput.value = user.email || '';
  }

  // Bind submit override (only once)
  if (form.getAttribute('data-firebase-bound')) return;
  form.setAttribute('data-firebase-bound', 'true');

  form.addEventListener('submit', async (e) => {
    const activeUser = auth.currentUser;
    if (!activeUser) {
      alert('Please click on the Workspace Partner Hub launcher (bottom-left) to Sign In with your Google Account before submitting so your request can be compiled of secure Firestore logs!');
      e.preventDefault();
      return;
    }

    e.preventDefault();

    const nameVal = form.querySelector('input[name="name"]')?.value || '';
    const emailVal = form.querySelector('input[name="email"]')?.value || '';
    const phoneVal = form.querySelector('input[name="phone"]')?.value || '';
    const businessNameVal = form.querySelector('input[name="business_name"]')?.value || '';
    const serviceVal = form.querySelector('select[name="service"]')?.value || 'Ecommerce Solutions';
    const budgetVal = form.querySelector('select[name="budget"]')?.value || 'Under $5,000/mo';
    const messageVal = form.querySelector('textarea[name="message"]')?.value || '';

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `Writing to Firestore Node...`;

    try {
      const docRef = await addDoc(collection(db, 'inquiries'), {
        name: nameVal,
        email: emailVal,
        phone: phoneVal,
        businessName: businessNameVal,
        service: serviceVal,
        monthlyBudget: budgetVal,
        message: messageVal,
        userId: activeUser.uid,
        createdAt: serverTimestamp()
      });

      console.log('Inquiry written to Firestore. Document ID:', docRef.id);
      
      // Let's also optionally auto-trigger a real-time notification draft send via Gmail to MarketOps if configured!
      try {
        if (confirm('Onboarding validated! Would you like to automatically draft and send a copy of this inquiry to connect@marketops.in directly from your workspace Gmail?')) {
          const rawEmailContent = [
            'To: connect@marketops.in',
            'Subject: New MarketOps Onboarding Inquiry from ' + businessNameVal,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            '',
            `💡 Submitted via Partner Hub Onboarding Node:<br />
            <strong>Contact Name:</strong> ${nameVal}<br />
            <strong>Company:</strong> ${businessNameVal}<br />
            <strong>Service Interest:</strong> ${serviceVal}<br />
            <strong>Monthly Budget:</strong> ${budgetVal}<br />
            <strong>Phone Coordinates:</strong> ${phoneVal}<br />
            <strong>Email:</strong> ${emailVal}<br />
            <strong>Message Details:</strong> "${messageVal}"`
          ].join('\r\n');

          const encodedRaw = base64UrlEncode(rawEmailContent);

          await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cachedAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ raw: encodedRaw })
          });
          alert('Contact RFP synchronized in Firestore & copied to MarketOps Inbox via Gmail API!');
        } else {
          alert('Contact RFP successfully written to Firestore database logs!');
        }
      } catch (gmailErr) {
        console.error('Optional automatic email copy failed:', gmailErr);
        alert('RFP logged in Firestore DB successfully! (Gmail dispatch was bypassed)');
      }

      form.reset();
      
      // Reload records list
      loadFirestoreInquiries();

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inquiries');
      alert('Inquiry log failed: Permission Denied. Check your Partner Hub credentials.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// Ensure execution hooks after content elements exist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWorkspaceHub);
} else {
  initWorkspaceHub();
}
