# Sportivox — End User Guide

> **Platform version:** Phase 1 MVP · **Document ref:** SRS-FRS-SPX-001 v1.0

---

## Table of Contents

1. [What is Sportivox?](#1-what-is-sportivox)
2. [User Roles](#2-user-roles)
3. [Getting Started](#3-getting-started)
4. [Your Profile](#4-your-profile)
5. [Opportunities](#5-opportunities)
6. [Applying to Opportunities (Athletes)](#6-applying-to-opportunities-athletes)
7. [Managing Applicants (Clubs & Organizers)](#7-managing-applicants-clubs--organizers)
8. [Search & Discovery](#8-search--discovery)
9. [Social Features — Posts, Reels & Blogs](#9-social-features--posts-reels--blogs)
10. [Messaging](#10-messaging)
11. [Notifications](#11-notifications)
12. [Verification & Trust Badges](#12-verification--trust-badges)
13. [AI Performance Tips (Athletes)](#13-ai-performance-tips-athletes)
14. [Admin Panel](#14-admin-panel)
15. [Account & Security](#15-account--security)
16. [Frequently Asked Questions](#16-frequently-asked-questions)

---

## 1. What is Sportivox?

Sportivox is a **sports networking and recruitment platform** that connects athletes, clubs, academies, scouts, and tournament organizers in one verified digital ecosystem.

The core problem it solves: talent discovery in sports is still largely informal. Players miss out on opportunities because the right people never find them, and clubs waste time searching through unverified profiles across fragmented channels.

**Sportivox brings everyone together in one place:**

| If you are… | Sportivox helps you… |
|---|---|
| An **Athlete** | Build a credible profile, find trials and scholarships, apply directly to clubs |
| A **Club / Academy** | Post open trials, search verified players, manage your applicant pipeline |
| A **Scout** | Discover talent across sports, save profiles, and connect with athletes |
| An **Organizer** | Create tournaments and events, accept registrations, manage participants |
| An **Admin** | Keep the platform trustworthy — verify identities, moderate content |

---

## 2. User Roles

Sportivox has **five distinct roles**. You select your role when you register. Your role determines what you can see and do on the platform.

### Athlete / Player
- Build a detailed sports profile with stats, achievements, and a CV
- Browse and apply to trials, scholarships, and recruitment opportunities
- Get personalized AI training tips
- Follow clubs and scouts; be discovered by them

### Club / Academy
- Create an organization profile with your badge and sport categories
- Post trials, recruitment drives, and coaching job listings
- Search and filter athletes by sport, location, age, experience, and more
- Manage your applicant pipeline (shortlist → select → reject)

### Scout / Promoter
- Search the full athlete database with advanced filters
- Save profiles and contact athletes directly
- Report to clubs or academies you work with

### Organizer
- Create tournament listings and event opportunities
- Manage registrations and participant lists
- Communicate with registered athletes

### Admin *(platform staff only)*
- Review and approve verification requests
- Moderate content and manage abuse reports
- Suspend or activate accounts
- Access full audit logs and platform analytics

> **Note:** Admin accounts are created only by the EASOPS platform team. You cannot register as an admin.

---

## 3. Getting Started

### 3.1 Sign Up

1. Go to the Sportivox web app and click **Sign Up**.
2. Enter your **full name**, **email address**, **phone number**, and **password**.
3. Select your **role** (Athlete, Club, Scout, or Organizer).
4. Click **Create Account**.
5. Check your email — click the **verification link** sent to you. Your account is inactive until this step is completed.

> Passwords must be at least 8 characters. They are hashed and never stored in plain text.

### 3.2 Log In

1. Click **Sign In** on the homepage.
2. Enter your email and password.
3. You will receive a **JWT access token** (valid 15 minutes) and a **refresh token** (valid 30 days). The app manages these automatically — you stay logged in without repeated sign-ins.

### 3.3 Forgot Password

1. Click **Forgot password?** on the Sign In page.
2. Enter your registered email.
3. Check your email for a reset link (valid for 30 minutes).
4. Click the link, enter your new password.
5. All existing sessions are automatically invalidated for security.

### 3.4 Change Password

Go to **Account → Change Password**. You must enter your current password to confirm. All sessions are revoked on change.

---

## 4. Your Profile

Your profile is the core of your presence on Sportivox. A complete, verified profile dramatically increases your chances of being discovered.

### 4.1 Fields Common to All Roles

| Field | Notes |
|---|---|
| Full Name | Displayed publicly |
| Profile Photo | JPG or PNG, max 5 MB |
| Cover Photo | Optional banner image |
| Bio | Free text, up to 500 characters |
| Location | Country / State / City — used for search filters |
| Date of Birth | Age is computed automatically for eligibility checks |
| Gender | Male / Female / Other / Prefer not to say |
| Phone Number | Include country code |

### 4.2 Athlete Profile — Additional Fields

| Field | Notes |
|---|---|
| Primary & Secondary Sport | Select from the platform sport taxonomy |
| Playing Role / Position | E.g. Striker, Goalkeeper, Left-back |
| Experience Level | Beginner / Amateur / Semi-Pro / Professional |
| Height & Weight | Optional fitness metrics |
| Current Team & History | With dates for each club |
| Achievements & Awards | Free text + year |
| Match Statistics | Sport-specific stats verified by a coach or supporting document |
| Sports CV | PDF upload, max 5 MB |
| Availability Status | Available / Not Available / Open to Offers |
| Looking for Club/Trial | Yes / No toggle — visible to scouts |

### 4.3 Club / Academy Profile

| Field | Notes |
|---|---|
| Organisation Name & Logo | Displayed on all listings |
| Organisation Type | Club, Academy, or both |
| Sport Categories | Multi-select |
| Year Established | |
| Address & Website | |
| Contact Person & Details | Defaults to opportunity listings |
| Verification Documents | Registration certificate — uploaded for admin review |
| Social Media Links | Optional |

### 4.4 Editing Your Profile

1. Go to **Profile → Edit Profile**.
2. Update any field.
3. Click **Save Changes**.

Profile photos and documents are uploaded securely to Google Cloud Storage. Private documents are accessed only through time-limited signed URLs.

---

## 5. Opportunities

Opportunities are the primary commercial feature of Sportivox. Clubs and organizers post listings; athletes apply.

### 5.1 Types of Opportunities

| Type | Who Posts | Who Can Apply |
|---|---|---|
| **Trial** | Club / Academy | Athletes |
| **Recruitment** | Club / Academy | Athletes |
| **Scholarship** | Club / Academy | Athletes |
| **Tournament** | Organizer | Athletes / Teams |
| **Coaching Job** | Club / Organizer | Scouts, Coaches |

### 5.2 What Every Listing Shows

- Title and sport
- Organisation name and verification badge
- Full description and requirements
- Eligibility: age range, gender, experience level
- Location (city, state, country)
- Dates: start, end, application deadline
- Number of vacancies remaining
- Entry fee (if any)
- Documents required from applicants
- Contact details

### 5.3 Posting an Opportunity (Clubs & Organizers)

1. Go to **Opportunities → Post New Opportunity**.
2. Fill in all required fields (title, sport, type, description, eligibility, dates).
3. Set an **application deadline** — the listing automatically closes at midnight on that date.
4. Optionally set a **vacancy count** — the listing auto-fills and closes when the last spot is taken.
5. Click **Publish**.

Your listing is immediately visible to athletes matching the criteria.

### 5.4 Browsing Opportunities (Athletes)

1. Go to the **Opportunities** section from the main navigation.
2. Use the filters to narrow results:
   - Sport, opportunity type, location, status
3. Click any listing to read the full details.
4. Click **Apply** if you meet the eligibility criteria.

---

## 6. Applying to Opportunities (Athletes)

### 6.1 How to Apply

1. Open an opportunity listing.
2. Review the eligibility requirements carefully.
3. Click **Apply**.
4. Add an optional **cover note** and attach any required documents.
5. Submit — you can only apply **once** per opportunity.

### 6.2 Application Status — What Each Stage Means

Your application moves through a defined lifecycle. You receive a notification at every stage change.

```
Pending  ──►  Shortlisted  ──►  Selected
   │               │
   └──►  Rejected ◄┘
   ↑
   │ (you can withdraw at any stage before selection is final)
   └──────────────────────────────────────────────
```

| Status | Meaning | Who Changes It |
|---|---|---|
| **Pending** | Your application is received and under review | System (on apply) |
| **Shortlisted** | The club has flagged you for further consideration | Club / Admin |
| **Selected** | You have been chosen — a vacancy has been filled for you | Club / Admin |
| **Rejected** | Your application was not successful this time | Club / Admin |
| **Withdrawn** | You cancelled your application | You |

### 6.3 Withdrawing an Application

1. Go to **My Applications**.
2. Find the application and click **Withdraw**.
3. If you were already **Selected**, the vacancy is restored for another applicant.

### 6.4 Tracking Your Applications

Go to **My Applications** from the dashboard. You can see all your applications, their current status, any rejection reasons provided, and the full history of each application.

---

## 7. Managing Applicants (Clubs & Organizers)

### 7.1 Viewing Your Applicants

1. Go to **Opportunities** and open a listing you posted.
2. Click **View Applicants**.
3. You see a full list with each applicant's profile, cover note, and uploaded documents.

### 7.2 Moving Applicants Through the Pipeline

On each applicant's entry, you can:

- **Shortlist** — move to shortlisted for further review
- **Select** — confirm the applicant; the vacancy count decrements by 1
- **Reject** — close the application with an optional reason

All state changes trigger an email + in-app notification to the athlete.

### 7.3 Vacancy Tracking

If you set a vacancy count on your listing:
- Each **Select** action reduces the remaining vacancy count by 1.
- When vacancies reach zero, the listing is automatically marked **Filled** and closed.
- If a selected athlete **withdraws**, their vacancy slot is restored.

---

## 8. Search & Discovery

### 8.1 Searching for Players (Scouts & Clubs)

Go to **Search → Players**. Available filters:

| Filter | Type |
|---|---|
| Keyword (name/sport) | Text |
| Sport | Multi-select |
| Country / State / City | Dropdown + radius |
| Age Range | Min / Max slider |
| Gender | Dropdown |
| Playing Role / Position | Multi-select |
| Experience Level | Dropdown |
| Verification Status | Toggle |
| Availability | Toggle |

### 8.2 Searching for Clubs & Academies

Go to **Search → Clubs**. Filter by name, sport category, location, organisation type, and verification status.

### 8.3 Searching for Opportunities

Go to **Search → Opportunities**. Filter by keyword, sport, opportunity type, location, and open/closed status.

### 8.4 How Results Are Ranked

1. Exact matches on name, sport, or location are ranked first.
2. Verified profiles rank above unverified.
3. More complete profiles rank higher.
4. Recently active users are boosted.
5. Higher reported statistics rank higher within the same sport and position.

---

## 9. Social Features — Posts, Reels & Blogs

### 9.1 Activity Posts

Share training logs and general updates with your followers.

1. Go to **Feed → New Post**.
2. Write your update, attach media (images), add sport tags.
3. Post — it appears in the feeds of everyone who follows you.

Other users can **like** and **comment** on your posts.

### 9.2 Reels

Share short-form video clips (training highlights, match moments).

1. Go to **Reels → New Reel**.
2. Upload your video (MP4 or WebM).
3. Add a caption and tags.

Reels appear in a scrollable feed. Users can like, comment, and view counts are tracked.

### 9.3 Blogs

Write long-form articles about sport, training, or your journey.

1. Go to **Blogs → New Blog**.
2. Write in Markdown. Add a cover image.
3. Save as **Draft** or **Publish** immediately.

Published blogs are publicly visible (to all logged-in users), searchable, and support likes and comments.

### 9.4 Following Other Users

- Click **Follow** on any user's profile page.
- Their posts, reels, and blogs will appear in your **Feed**.
- Your follower and following counts are displayed on your profile.
- The person you follow receives a notification.

---

## 10. Messaging

Sportivox has built-in direct messaging so you can communicate without leaving the platform.

### 10.1 Starting a Conversation

1. Go to a user's profile.
2. Click **Message**.
3. A conversation thread is created (or the existing one is opened if you have messaged before).
4. Type your message and hit **Send**.

### 10.2 Inbox

Go to **Messages** in the navigation bar. You see all your conversation threads, ordered by most recent. An unread badge shows how many messages you haven't read yet.

### 10.3 Who Can Message Whom

- Athletes can message clubs, scouts, and organizers they find on the platform.
- Clubs and scouts can message any athlete.
- Conversations are private — only the two participants can read them (admins can access threads flagged for abuse review).

> **Phase 1 note:** Messages are asynchronous (standard inbox, not real-time chat). Real-time WebSocket messaging is planned for Phase 2 alongside the mobile apps.

---

## 11. Notifications

Sportivox keeps you informed at every important moment.

### 11.1 In-App Notifications

Click the **bell icon** in the navigation bar to see all notifications. You can:
- View all notifications
- Filter to **unread only**
- Mark individual notifications or all notifications as read

### 11.2 Email Notifications

The following events trigger both an in-app notification and an email:

| Event | Who Gets Notified |
|---|---|
| New application received on your listing | Club / Organizer |
| Your application has been shortlisted | Athlete |
| Your application has been selected | Athlete |
| New direct message received | Recipient |
| Your verification has been approved or rejected | Applicant user/org |

### 11.3 In-App Only Notifications

| Event | Who Gets Notified |
|---|---|
| Application rejected | Athlete |
| New follower | You |
| Your profile was viewed by a scout/club | Athlete |
| New relevant opportunity matching your sport/region | Athlete |

---

## 12. Verification & Trust Badges

Verification is what separates Sportivox from a generic social network. Verified badges appear on all profiles and listings, giving every user confidence that the people and organisations they deal with are genuine.

### 12.1 Available Badges

| Badge | Who Can Earn It | What Is Verified |
|---|---|---|
| **Verified Player** | Athletes | Phone, email, government ID, stats or coach endorsement |
| **Verified Coach** | Coaches | Coaching licence or certification + admin approval |
| **Verified Club** | Clubs | Registration certificate + admin approval |
| **Verified Academy** | Academies | Registration certificate + admin approval |
| **Verified Scout** | Scouts | Identity document + organisation association |
| **Verified Stats** | Athletes | Stats source document or endorsement by a verified coach |

### 12.2 How to Get Verified

**For Athletes:**
1. Verify your phone number via OTP during registration.
2. Verify your email via the link sent on signup.
3. Upload a government-issued ID through **Profile → Verification**.
4. Attach performance statistics with a supporting document or a coach endorsement.
5. An admin reviews your submission. You receive a notification on approval or rejection with a reason.

**For Clubs & Academies:**
1. Go to **My Organisations → Verification**.
2. Upload your club's registration certificate.
3. An admin verifies your website, social presence, and contact details.
4. You receive a notification on approval.

### 12.3 Why Verification Matters

- Verified profiles rank higher in search results.
- Verified badges are displayed on your profile and on all your opportunity listings.
- Scouts and clubs are far more likely to engage with verified athletes.
- Athletes are more likely to apply to verified clubs.

---

## 13. AI Performance Tips (Athletes)

Athletes get access to personalised, AI-generated training recommendations based on their reported statistics.

### 13.1 How to Use It

1. Make sure your profile statistics are filled in (sport, position, performance stats).
2. Go to **Dashboard → AI Tips** or navigate to **/ai-tips**.
3. Click **Get My Tips**.
4. The platform sends your stats to the OpenAI API and returns personalised tips within a few seconds.
5. Tips are displayed directly on your dashboard.

### 13.2 Rate Limits

To prevent excessive API usage, the following limits apply per athlete account:
- Minimum **30 seconds** between requests.
- Maximum **20 requests per day**.

If the OpenAI service is unavailable, you will receive a set of standard fallback tips instead.

> **Note:** The OpenAI integration is powered by the client's own API account. Tip quality depends on the completeness and accuracy of the stats you have entered on your profile.

---

## 14. Admin Panel

The admin panel is a restricted section accessible only to users with the **Admin** role. It is the control room for keeping the platform trustworthy.

### 14.1 User Management

- View all registered users with filters for status (Pending / Active / Suspended) and role.
- **Activate** accounts that have been flagged as pending.
- **Suspend** accounts that violate platform rules.
- View individual user profiles and their activity.

### 14.2 Verification Review

- See all pending KYC and document submissions.
- Review uploaded government IDs, club registration certificates, and coaching licences.
- **Approve** or **Reject** each submission with a reason.
- Assign or revoke verification badges on any profile.

### 14.3 Abuse Reports & Moderation

- Users can submit abuse reports from any profile or content item.
- Admins review all incoming reports.
- Available actions: dismiss the report, warn the user, remove content, or suspend the account.
- Every action is recorded in the audit log.

### 14.4 Audit Log

Every admin action is permanently recorded with:
- The admin who performed the action
- The action taken
- The target (user, content, or report)
- Timestamp and IP address

The audit log is read-only from within the app — records cannot be edited or deleted.

### 14.5 Analytics

The admin analytics panel shows:
- Total and active user counts by role
- Application submission and completion rates
- Verification request volumes
- Content posted (posts, reels, blogs)
- Platform growth trends

---

## 15. Account & Security

### 15.1 Session Management

- You are kept logged in via a **refresh token** (valid 30 days, single-use, automatically rotated).
- Changing your password **invalidates all active sessions** across all devices.
- You can manually **log out** at any time — this revokes your refresh token immediately.

### 15.2 File Uploads

All files you upload (photos, documents, videos) are stored securely on Google Cloud Storage.

- **Profile photos and media** — served via a fast public CDN.
- **Private documents** (KYC IDs, sports CVs, registration certificates) — accessible only through time-limited signed URLs. Direct permanent links are never issued.

Allowed file types:
- Images: JPEG, PNG, WebP (max 5 MB for profile photos)
- Documents: PDF (max 5 MB)
- Videos: MP4, WebM

### 15.3 Data Privacy

- Your password is hashed with bcrypt (minimum 12 salt rounds) and never stored or logged in plain text.
- Private messages are only accessible to the two participants in the conversation.
- Your contact details are only visible on your own profile page and on opportunity listings you post.
- KYC documents are stored in a private, access-controlled bucket and reviewed only by platform admins.

### 15.4 Reporting Abuse

If you encounter abusive behaviour, inappropriate content, or a fake profile:

1. Go to the profile or content item.
2. Click the **Report** button (usually a flag icon or the three-dot menu).
3. Select a reason and add any details.
4. Submit — the report is sent to admins for review.

---

## 16. Frequently Asked Questions

**Can I change my role after registering?**
No. Your role is set at registration and cannot be changed from the app. If you need a different role, please contact platform support.

**Why is my account still inactive after signing up?**
You need to verify your email. Check your inbox (and spam folder) for a verification email from Sportivox and click the link inside it.

**I applied to an opportunity but I haven't heard back. What should I do?**
Your application status is visible in **My Applications**. If the status is still "Pending", the club has not yet reviewed it. You can send a direct message to the club if their profile allows it.

**Can I apply to the same opportunity more than once?**
No. Each athlete can only submit one application per opportunity.

**What happens when an opportunity's deadline passes?**
The listing automatically closes at midnight on the deadline date. No new applications can be submitted after that point.

**How long does verification take?**
Verification is reviewed manually by the platform admin team. During the beta phase, review typically takes 1–3 business days.

**Can I delete my account?**
To request account deletion, contact the platform support team. All your data will be removed in accordance with the platform's privacy policy.

**Are my private messages secure?**
Yes. Only you and the person you are messaging can read your conversation. Admins can access threads only if they have been formally flagged for abuse review.

**My AI tips aren't loading. What's wrong?**
Check that your profile stats are filled in — the AI needs your sport data to generate useful tips. If the service is temporarily unavailable, fallback tips will be shown instead. Also note the 30-second cooldown between requests.

**What does the Verified badge mean?**
It means the platform's admin team has reviewed and confirmed the identity or credentials of that user or organisation. You should have higher confidence engaging with verified profiles.

---

*Sportivox is developed by EASOPS Technologies PVT LTD. For support, contact the platform team via the in-app help link.*

*Document version: 1.0 · Last updated: June 2026*
