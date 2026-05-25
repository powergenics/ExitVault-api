const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 8080;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADVISOR_EMAIL = process.env.ADVISOR_EMAIL || 'thomas@addisonsa.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@exitvault.addisonsa.com';

// In-memory code store — { email: { code, expires, attempts } }
const codeStore = new Map();

app.use(cors({
  origin: [
    'https://exitvault.addisonsa.com',
    'https://exitvault.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ]
}));
app.use(express.json());

// ── HEALTH CHECK ──────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ExitVault API running', timestamp: new Date().toISOString() });
});

// ── SEND VERIFICATION CODE ──────────────────────
app.post('/api/send-code', async (req, res) => {
  const { firstName, lastName, email, phone } = req.body;

  if (!email || !firstName) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Rate limiting — max 3 codes per email per hour
  const existing = codeStore.get(email.toLowerCase());
  if (existing && existing.attempts >= 3 && Date.now() < existing.expires) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in an hour.' });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + (15 * 60 * 1000); // 15 minutes

  codeStore.set(email.toLowerCase(), {
    code,
    expires,
    attempts: (existing?.attempts || 0) + 1,
    firstName,
    lastName,
    phone
  });

  // Send verification email
  try {
    const resend = new Resend(RESEND_API_KEY);

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your ExitVault Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background:#0f1e35;font-family:'Georgia',serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1e35;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#1b2a4a;border:1px solid rgba(201,168,76,0.2);">
                  
                  <!-- Header bar -->
                  <tr>
                    <td style="background:linear-gradient(90deg,#8a6f33,#c9a84c,#e2c47a,#c9a84c,#8a6f33);height:3px;"></td>
                  </tr>
                  
                  <!-- Logo -->
                  <tr>
                    <td align="center" style="padding:32px 40px 24px;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:600;color:#f8f4ee;letter-spacing:0.08em;">
                        Exit<span style="color:#c9a84c;">Vault</span>
                      </p>
                      <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8a8580;">
                        Exit Readiness Assessment
                      </p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:0 40px 32px;">
                      <p style="font-family:Georgia,serif;font-size:18px;font-weight:300;color:#f8f4ee;margin:0 0 16px;">
                        Hello ${firstName},
                      </p>
                      <p style="font-family:Georgia,serif;font-size:15px;font-weight:300;color:#d4cfc8;line-height:1.7;margin:0 0 32px;">
                        Here is your verification code to access your Exit Readiness Assessment. 
                        This code expires in 15 minutes.
                      </p>

                      <!-- Code box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                        <tr>
                          <td align="center" style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.3);padding:28px;">
                            <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8a6f33;margin-bottom:12px;">
                              Your Verification Code
                            </p>
                            <p style="margin:0;font-family:Georgia,serif;font-size:42px;font-weight:300;color:#c9a84c;letter-spacing:0.3em;">
                              ${code}
                            </p>
                          </td>
                        </tr>
                      </table>

                      <p style="font-family:Georgia,serif;font-size:13px;font-weight:300;font-style:italic;color:#8a8580;line-height:1.6;margin:0;">
                        If you did not request this code, you can safely ignore this email. 
                        Someone may have entered your email address by mistake.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="border-top:1px solid rgba(201,168,76,0.1);padding:20px 40px;text-align:center;">
                      <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#8a8580;">
                        Thomas Addison &nbsp;·&nbsp; CEPA &nbsp;·&nbsp; CBEC &nbsp;·&nbsp; CISSP &nbsp;·&nbsp; Duke MBA
                      </p>
                      <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#8a8580;">
                        <a href="https://exitvault.addisonsa.com" style="color:#c9a84c;text-decoration:none;">exitvault.addisonsa.com</a>
                        &nbsp;·&nbsp;
                        <a href="https://addisonsa.com" style="color:#c9a84c;text-decoration:none;">addisonsa.com</a>
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    res.json({ success: true, message: 'Verification code sent.' });

  } catch (err) {
    console.error('Send code error:', err);
    res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
  }
});

// ── VERIFY CODE ──────────────────────
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required.' });
  }

  const stored = codeStore.get(email.toLowerCase());

  if (!stored) {
    return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
  }

  if (Date.now() > stored.expires) {
    codeStore.delete(email.toLowerCase());
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  if (stored.code !== code.trim()) {
    return res.status(400).json({ error: 'Incorrect code. Please check your email and try again.' });
  }

  // Code is valid — mark as verified
  stored.verified = true;
  codeStore.set(email.toLowerCase(), stored);

  res.json({ success: true, message: 'Email verified.' });
});

// ── SUBMIT RESULTS ──────────────────────
app.post('/api/submit-results', async (req, res) => {
  const {
    firstName, lastName, email, phone,
    personalScore, financialScore, quadrant,
    situationalAnswers, openText
  } = req.body;

  // Verify email was confirmed
  const stored = codeStore.get(email?.toLowerCase());
  if (!stored?.verified) {
    return res.status(403).json({ error: 'Email not verified.' });
  }

  const quadrantNames = {
    Q1: 'Stay & Grow',
    Q2: 'Maximize Value',
    Q3: 'The Reluctant Owner',
    Q4: 'Rich & Ready'
  };

  const quadrantName = quadrantNames[quadrant] || quadrant;
  const fullName = `${firstName} ${lastName}`.trim();
  const phoneDisplay = phone || 'Not provided';

  const sit = situationalAnswers || [];

  try {
    const resend = new Resend(RESEND_API_KEY);

    // ── EMAIL 1: Lead notification to advisor ──
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADVISOR_EMAIL,
      subject: `New ExitVault Lead — ${fullName} — ${quadrantName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f8f4ee;font-family:Georgia,serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f4ee;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d4cfc8;">
                  
                  <tr>
                    <td style="background:linear-gradient(90deg,#8a6f33,#c9a84c,#e2c47a,#c9a84c,#8a6f33);height:3px;"></td>
                  </tr>

                  <!-- Header -->
                  <tr>
                    <td style="background:#0f1e35;padding:24px 40px;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#f8f4ee;">
                        Exit<span style="color:#c9a84c;">Vault</span>
                        <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:300;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;margin-left:12px;">New Lead</span>
                      </p>
                    </td>
                  </tr>

                  <!-- Quadrant banner -->
                  <tr>
                    <td style="background:#1b2a4a;padding:20px 40px;border-bottom:1px solid rgba(201,168,76,0.2);">
                      <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8a6f33;">Quadrant Placement</p>
                      <p style="margin:6px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:300;color:#c9a84c;">${quadrantName}</p>
                    </td>
                  </tr>

                  <!-- Contact info -->
                  <tr>
                    <td style="padding:28px 40px;border-bottom:1px solid #ede8df;">
                      <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;">Contact Information</p>
                      <p style="margin:12px 0 4px;font-family:Georgia,serif;font-size:20px;color:#1a1a1a;">${fullName}</p>
                      <p style="margin:4px 0;font-family:Arial,sans-serif;font-size:13px;color:#444;">
                        <a href="mailto:${email}" style="color:#1b2a4a;">${email}</a>
                      </p>
                      <p style="margin:4px 0;font-family:Arial,sans-serif;font-size:13px;color:#444;">${phoneDisplay}</p>
                    </td>
                  </tr>

                  <!-- Scores -->
                  <tr>
                    <td style="padding:28px 40px;border-bottom:1px solid #ede8df;">
                      <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;">Assessment Scores</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="48%" style="background:#f8f4ee;border:1px solid #d4cfc8;padding:16px;text-align:center;">
                            <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;">Personal Readiness</p>
                            <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:32px;font-weight:300;color:#1b2a4a;">${personalScore}<span style="font-size:14px;color:#8a8580;"> / 15</span></p>
                          </td>
                          <td width="4%"></td>
                          <td width="48%" style="background:#f8f4ee;border:1px solid #d4cfc8;padding:16px;text-align:center;">
                            <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;">Financial Readiness</p>
                            <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:32px;font-weight:300;color:#1b2a4a;">${financialScore}<span style="font-size:14px;color:#8a8580;"> / 15</span></p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Situational answers -->
                  <tr>
                    <td style="padding:28px 40px;border-bottom:1px solid #ede8df;">
                      <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;">Situational Answers</p>
                      ${[
                        ['Current Situation', sit[0]],
                        ['90-Day Goal', sit[1]],
                        ['Primary Obstacle', sit[2]],
                        ['Preferred Way to Work', sit[3]]
                      ].map(([label, answer]) => `
                        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#8a6f33;">${label}</p>
                        <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:14px;color:#333;line-height:1.5;">${answer || 'Not answered'}</p>
                      `).join('')}
                      ${openText ? `
                        <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#8a6f33;">Additional Notes</p>
                        <p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#333;line-height:1.5;">${openText}</p>
                      ` : ''}
                    </td>
                  </tr>

                  <!-- CTA -->
                  <tr>
                    <td style="padding:28px 40px;text-align:center;">
                      <a href="https://calendar.app.google/cYv64HLDdnt95R3W6" 
                         style="display:inline-block;background:#1b2a4a;color:#c9a84c;font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;padding:14px 32px;">
                        Schedule Follow-Up Call
                      </a>
                      <p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#8a8580;">
                        Reply directly to this email to reach ${firstName} at ${email}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#0f1e35;padding:16px 40px;text-align:center;">
                      <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#8a8580;letter-spacing:0.1em;">
                        ExitVault &nbsp;·&nbsp; exitvault.addisonsa.com &nbsp;·&nbsp; Addison Advisory
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    // ── EMAIL 2: Results to owner ──
    const quadrantDescriptions = {
      Q1: 'Your results show you are in building mode — financially and personally early stage. The most valuable thing you can do right now is define your number and begin the thinking that most owners defer until it is too late.',
      Q2: 'Your results show you know exactly what you want after the business — and the gap is financial, not personal. The business needs to reach a number it has not yet hit, and closing that gap deliberately is the work ahead.',
      Q3: 'Your results show you are financially positioned but have not yet built a life compelling enough to leave for. This is the most common pattern among business owners — and it is entirely solvable with the right guidance.',
      Q4: 'Your results show strong readiness on both dimensions. The work ahead is stress testing the plan — making sure the confidence you have is built on the full picture, not the best case.'
    };

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: ADVISOR_EMAIL,
      subject: `Your ExitVault Results — ${quadrantName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#0f1e35;font-family:Georgia,serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1e35;padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#1b2a4a;border:1px solid rgba(201,168,76,0.2);">

                  <tr>
                    <td style="background:linear-gradient(90deg,#8a6f33,#c9a84c,#e2c47a,#c9a84c,#8a6f33);height:3px;"></td>
                  </tr>

                  <!-- Logo -->
                  <tr>
                    <td align="center" style="padding:32px 40px 16px;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:600;color:#f8f4ee;letter-spacing:0.08em;">
                        Exit<span style="color:#c9a84c;">Vault</span>
                      </p>
                      <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#8a8580;">
                        Your Exit Readiness Results
                      </p>
                    </td>
                  </tr>

                  <!-- Greeting -->
                  <tr>
                    <td style="padding:16px 40px 0;">
                      <p style="font-family:Georgia,serif;font-size:17px;font-weight:300;color:#f8f4ee;margin:0 0 12px;">
                        ${firstName}, here are your results.
                      </p>
                      <p style="font-family:Georgia,serif;font-size:14px;font-weight:300;font-style:italic;color:#d4cfc8;line-height:1.7;margin:0 0 24px;">
                        You completed the ExitVault Exit Readiness Assessment. What follows is an honest picture of where you stand — and what it means.
                      </p>
                    </td>
                  </tr>

                  <!-- Quadrant -->
                  <tr>
                    <td style="padding:0 40px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:rgba(201,168,76,0.08);border-left:3px solid #c9a84c;padding:20px 24px;">
                            <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:#8a6f33;">Your Quadrant</p>
                            <p style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;font-weight:300;color:#c9a84c;">${quadrantName}</p>
                            <p style="margin:0;font-family:Georgia,serif;font-size:14px;font-weight:300;color:#d4cfc8;line-height:1.7;">
                              ${quadrantDescriptions[quadrant]}
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Scores -->
                  <tr>
                    <td style="padding:0 40px 28px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="48%" style="background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.15);padding:16px;text-align:center;">
                            <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;">Personal Readiness</p>
                            <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:30px;font-weight:300;color:#c9a84c;">${personalScore}<span style="font-size:13px;color:#8a8580;"> / 15</span></p>
                          </td>
                          <td width="4%"></td>
                          <td width="48%" style="background:rgba(255,255,255,0.04);border:1px solid rgba(201,168,76,0.15);padding:16px;text-align:center;">
                            <p style="margin:0;font-family:Arial,sans-serif;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8580;">Financial Readiness</p>
                            <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:30px;font-weight:300;color:#c9a84c;">${financialScore}<span style="font-size:13px;color:#8a8580;"> / 15</span></p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Next step -->
                  <tr>
                    <td style="padding:0 40px 32px;">
                      <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a6f33;">Your Next Step</p>
                      <p style="margin:0 0 20px;font-family:Georgia,serif;font-size:14px;font-weight:300;color:#d4cfc8;line-height:1.7;">
                        A no-obligation conversation with Thomas Addison — CEPA, CISSP, Duke MBA — to talk through what your results mean and what your options look like. No pressure. Just clarity.
                      </p>
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:linear-gradient(135deg,#c9a84c,#e2c47a);">
                            <a href="https://calendar.app.google/cYv64HLDdnt95R3W6"
                               style="display:block;padding:14px 32px;font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#0f1e35;text-decoration:none;">
                              Schedule a Free Conversation
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="border-top:1px solid rgba(201,168,76,0.1);padding:20px 40px;text-align:center;">
                      <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#8a8580;">
                        Thomas Addison &nbsp;·&nbsp; CEPA &nbsp;·&nbsp; CBEC &nbsp;·&nbsp; CISSP &nbsp;·&nbsp; Duke MBA
                      </p>
                      <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#8a8580;">
                        <a href="https://exitvault.addisonsa.com" style="color:#c9a84c;text-decoration:none;">exitvault.addisonsa.com</a>
                        &nbsp;·&nbsp;
                        <a href="https://addisonsa.com" style="color:#c9a84c;text-decoration:none;">addisonsa.com</a>
                        &nbsp;·&nbsp;
                        <a href="mailto:thomas@addisonsa.com" style="color:#c9a84c;text-decoration:none;">thomas@addisonsa.com</a>
                      </p>
                      <p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#8a8580;">
                        You received this because you completed the ExitVault assessment.<br>
                        To unsubscribe reply with "unsubscribe" in the subject line.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });

    // Clean up verified code
    codeStore.delete(email.toLowerCase());

    res.json({ success: true, message: 'Results submitted and emails sent.' });

  } catch (err) {
    console.error('Submit results error:', err);
    res.status(500).json({ error: 'Failed to send results emails. Please try again.' });
  }
});

// ── START ──────────────────────────────
app.listen(PORT, () => {
  console.log(`ExitVault API running on port ${PORT}`);
});
