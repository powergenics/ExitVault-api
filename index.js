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
      from: `Thomas Addison <${FROM_EMAIL}>`,
      to: email,
      subject: 'Your ExitVault Verification Code — Action Required',
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
      from: `Thomas Addison <${FROM_EMAIL}>`,
      to: ADVISOR_EMAIL,
      subject: `New ExitVault Lead — ${fullName} — ${quadrantName}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#222222;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dddddd;margin:20px auto;">

  <tr><td style="background:#1b2a4a;padding:20px 32px;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;">
      Exit<span style="color:#c9a84c;">Vault</span>
      <span style="font-size:12px;font-weight:400;color:#aaaaaa;margin-left:12px;">New Lead</span>
    </p>
  </td></tr>

  <tr><td style="background:#c9a84c;padding:12px 32px;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#000000;">Quadrant: ${quadrantName}</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #eeeeee;">
    <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#999999;">Contact</p>
    <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#222222;">${fullName}</p>
    <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:14px;color:#1b2a4a;">${email}</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#555555;">${phoneDisplay}</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #eeeeee;">
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#999999;">Scores</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="background:#f5f5f5;border:1px solid #dddddd;padding:12px;text-align:center;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.1em;">Personal Readiness</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:#1b2a4a;">${personalScore}<span style="font-size:14px;color:#999999;">/15</span></p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:#f5f5f5;border:1px solid #dddddd;padding:12px;text-align:center;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.1em;">Financial Readiness</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:#1b2a4a;">${financialScore}<span style="font-size:14px;color:#999999;">/15</span></p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #eeeeee;">
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#999999;">Situational Answers</p>
    ${[['Current Situation',sit[0]],['90-Day Goal',sit[1]],['Primary Obstacle',sit[2]],['Preferred Way to Work',sit[3]]].map(([label,answer])=>`
    <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#c9a84c;">${label}</p>
    <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;color:#333333;">${answer||'Not answered'}</p>
    `).join('')}
    ${openText?`<p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#c9a84c;">Additional Notes</p><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#333333;">${openText}</p>`:''}
  </td></tr>

  <tr><td style="padding:24px 32px;text-align:center;background:#f9f9f9;">
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#333333;">Schedule your follow-up call with ${firstName}:</p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:700;">
      <a href="https://calendar.app.google/cYv64HLDdnt95R3W6" 
         style="color:#1b2a4a;text-decoration:underline;font-family:Arial,sans-serif;">
        Click here to schedule
      </a>
    </p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#777777;">
      Or reply to this email — it goes directly to ${email}
    </p>
  </td></tr>

  <tr><td style="padding:16px 32px;background:#f5f5f5;border-top:1px solid #dddddd;text-align:center;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#999999;">
      ExitVault &nbsp;·&nbsp; Addison Advisory &nbsp;·&nbsp; exitvault.addisonsa.com
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
    });

    // ── EMAIL 2: Results to owner ──
    const quadrantDescriptions = {
      Q1: 'Your results show you are in building mode — financially and personally early stage. The most valuable thing you can do right now is define your number and begin the thinking that most owners defer until it is too late.',
      Q2: 'Your results show you know exactly what you want after the business — and the gap is financial, not personal. The business needs to reach a number it has not yet hit, and closing that gap deliberately is the work ahead.',
      Q3: 'Your results show you are financially positioned but have not yet built a life compelling enough to leave for. This is the most common pattern among business owners — and it is entirely solvable with the right guidance.',
      Q4: 'Your results show strong readiness on both dimensions. The work ahead is stress testing the plan — making sure the confidence you have is built on the full picture, not the best case.'
    };

    await resend.emails.send({
      from: `Thomas Addison <${FROM_EMAIL}>`,
      to: email,
      replyTo: ADVISOR_EMAIL,
      subject: `Your ExitVault Results — ${quadrantName}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#222222;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dddddd;margin:20px auto;">

  <tr><td style="background:#1b2a4a;padding:20px 32px;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;">
      Exit<span style="color:#c9a84c;">Vault</span>
    </p>
    <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#aaaaaa;letter-spacing:0.15em;text-transform:uppercase;">Your Exit Readiness Results</p>
  </td></tr>

  <tr><td style="background:#c9a84c;padding:12px 32px;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#000000;">Your Quadrant: ${quadrantName}</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #eeeeee;">
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:16px;color:#222222;">Hello ${firstName},</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#444444;line-height:1.7;">${quadrantDescriptions[quadrant]}</p>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #eeeeee;">
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#999999;">Your Scores</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="background:#f5f5f5;border:1px solid #dddddd;padding:12px;text-align:center;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.1em;">Personal Readiness</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:#1b2a4a;">${personalScore}<span style="font-size:14px;color:#999999;">/15</span></p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:#f5f5f5;border:1px solid #dddddd;padding:12px;text-align:center;">
          <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:0.1em;">Financial Readiness</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:28px;font-weight:700;color:#1b2a4a;">${financialScore}<span style="font-size:14px;color:#999999;">/15</span></p>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:24px 32px;border-bottom:1px solid #eeeeee;background:#f9f9f9;">
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#999999;">Your Next Step</p>
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#333333;line-height:1.7;">
      A no-obligation conversation with Thomas Addison — CEPA, CISSP, Duke MBA — to talk through what your results mean and what your real options look like. No pressure. Just clarity.
    </p>
    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#222222;">
      Schedule your free conversation:
    </p>
    <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:15px;">
      <a href="https://calendar.app.google/cYv64HLDdnt95R3W6" 
         target="_blank"
         style="color:#1b2a4a;font-weight:700;text-decoration:underline;">
        https://calendar.app.google/cYv64HLDdnt95R3W6
      </a>
    </p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#777777;">
      Or simply reply to this email and I will be in touch.
    </p>
  </td></tr>

  <tr><td style="padding:20px 32px;border-top:1px solid #dddddd;text-align:center;background:#f5f5f5;">
    <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#1b2a4a;">Thomas Addison &nbsp;·&nbsp; CEPA &nbsp;·&nbsp; CBEC &nbsp;·&nbsp; CISSP &nbsp;·&nbsp; Duke MBA</p>
    <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;color:#777777;">
      <a href="https://exitvault.addisonsa.com" style="color:#1b2a4a;text-decoration:underline;">exitvault.addisonsa.com</a>
      &nbsp;·&nbsp;
      <a href="https://addisonsa.com" style="color:#1b2a4a;text-decoration:underline;">addisonsa.com</a>
    </p>
    <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:10px;color:#aaaaaa;">
      Addison Advisory &nbsp;·&nbsp; Virginia, USA<br>
      You received this because you completed the ExitVault assessment.<br>
      To unsubscribe reply with "unsubscribe" in the subject line.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
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
