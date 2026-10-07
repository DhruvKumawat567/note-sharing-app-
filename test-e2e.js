/**
 * End-to-end automated verification script for Note-Sharing POC
 */
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting End-to-End Test Suite...\n');
  let failures = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
    } else {
      console.error(`❌ FAIL: ${testName} - ${details}`);
      failures++;
    }
  }

  // 1. Test Demo User Login
  console.log('\n--- 1. Testing Authentication ---');
  let authCookie = '';
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@peacockindia.in',
        password: 'Password123!',
      }),
    });

    const loginData = await loginRes.json();
    assert(loginRes.ok && loginData.success, 'Login with demo credentials', JSON.stringify(loginData));
    
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      authCookie = setCookie.split(';')[0];
    }
    assert(authCookie.includes('note_auth_token'), 'Session cookie issued');
  } catch (err) {
    assert(false, 'Login request failed', err.message);
  }

  // 2. Test Get Current User
  try {
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: authCookie },
    });
    const meData = await meRes.json();
    assert(meRes.ok && meData.user?.email === 'demo@peacockindia.in', 'Verify session (/api/auth/me)');
  } catch (err) {
    assert(false, 'Auth verification failed', err.message);
  }

  // 3. Test Note Creation: One-Time + Password-Protected
  console.log('\n--- 2. Testing Note & Share Link Generation ---');
  let protectedNoteLink = null;
  let protectedPassword = null;
  try {
    const noteRes = await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        title: 'Top Secret API Key',
        content: 'AWS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nSECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        share_type: 'ONE_TIME',
        access_type: 'PASSWORD_PROTECTED',
      }),
    });

    const noteData = await noteRes.json();
    assert(noteRes.ok && noteData.success, 'Create One-Time Password-Protected Note');
    assert(!!noteData.shareLink?.token, 'Share token generated');
    assert(!!noteData.shareLink?.plain_password, `Dynamic password generated: ${noteData.shareLink?.plain_password}`);
    
    protectedNoteLink = noteData.shareLink;
    protectedPassword = noteData.shareLink.plain_password;
  } catch (err) {
    assert(false, 'Note creation failed', err.message);
  }

  // 4. Test Note Creation: Public One-Time
  let publicOneTimeLink = null;
  try {
    const pubRes = await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        title: 'Public Incident Memo',
        content: 'System maintenance scheduled for midnight UTC.',
        share_type: 'ONE_TIME',
        access_type: 'PUBLIC',
      }),
    });
    const pubData = await pubRes.json();
    assert(pubRes.ok && pubData.success, 'Create Public One-Time Note');
    publicOneTimeLink = pubData.shareLink;
  } catch (err) {
    assert(false, 'Public note creation failed', err.message);
  }

  // 5. Test Public One-Time Consumption and Subsequent Lockout
  console.log('\n--- 3. Testing Public One-Time Access & Expiry ---');
  try {
    // First view
    const view1 = await fetch(`${BASE_URL}/api/share/${publicOneTimeLink.token}`);
    const view1Data = await view1.json();
    assert(view1.ok && view1Data.status === 'PUBLIC_AVAILABLE', 'First view succeeds');
    assert(view1Data.view_count === 1, 'View count incremented to 1');
    assert(view1Data.note?.content.includes('System maintenance'), 'Note content decrypted/returned');

    // Second view (Must be expired / already used!)
    const view2 = await fetch(`${BASE_URL}/api/share/${publicOneTimeLink.token}`);
    const view2Data = await view2.json();
    assert(view2.status === 410, 'Second view returns 410 Gone / ALREADY_USED');
    assert(view2Data.status === 'ALREADY_USED', 'Status correctly reports ALREADY_USED');
    assert(!view2Data.note, 'Content not revealed after one-time expiration');
  } catch (err) {
    assert(false, 'One-time link access test failed', err.message);
  }

  // 6. Test Password-Protected Flow
  console.log('\n--- 4. Testing Password Protection & Edge Cases ---');
  try {
    // 6a. GET without password must require password and NOT reveal note or increment view
    const getProtected = await fetch(`${BASE_URL}/api/share/${protectedNoteLink.token}`);
    const getProtData = await getProtected.json();
    assert(getProtData.status === 'PASSWORD_REQUIRED', 'Initial GET returns PASSWORD_REQUIRED');
    assert(!getProtData.note, 'Note content withheld before unlock');

    // 6b. Unlock with Wrong Password
    const wrongRes = await fetch(`${BASE_URL}/api/share/${protectedNoteLink.token}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'WrongPassword123!' }),
    });
    const wrongData = await wrongRes.json();
    assert(wrongRes.status === 401, 'Wrong password returns 401 Unauthorized');
    assert(wrongData.remainingAttempts !== undefined, `Brute-force protection reports remaining attempts: ${wrongData.remainingAttempts}`);

    // 6c. Unlock with Correct Dynamic Password
    const correctRes = await fetch(`${BASE_URL}/api/share/${protectedNoteLink.token}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: protectedPassword }),
    });
    const correctData = await correctRes.json();
    assert(correctRes.ok && correctData.success, 'Correct password unlocks note successfully');
    assert(correctData.view_count === 1, 'View count incremented to 1 on valid unlock');
    assert(correctData.note?.content.includes('AKIAIOSFODNN7EXAMPLE'), 'Secret content revealed');

    // 6d. Next unlock on one-time link should fail as already used
    const replayRes = await fetch(`${BASE_URL}/api/share/${protectedNoteLink.token}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: protectedPassword }),
    });
    assert(replayRes.status === 410, 'Replay attempt returns 410 (one-time link already consumed)');
  } catch (err) {
    assert(false, 'Password protection test failed', err.message);
  }

  // 7. Test Revoke / Invalidate Link
  console.log('\n--- 5. Testing Force Invalidation / Revocation ---');
  try {
    // Create another note with a public time-based link
    const timeNoteRes = await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        title: 'Revocation Test Note',
        content: 'This note will be revoked by owner immediately.',
        share_type: 'TIME_BASED',
        access_type: 'PUBLIC',
        expires_in_minutes: 60,
      }),
    });
    const timeNoteData = await timeNoteRes.json();
    const linkId = timeNoteData.shareLink.id;
    const token = timeNoteData.shareLink.token;

    // Verify it works initially
    const preCheck = await fetch(`${BASE_URL}/api/share/${token}`);
    assert(preCheck.ok, 'Time-based link accessible initially');

    // Owner revokes link
    const revokeRes = await fetch(`${BASE_URL}/api/share/revoke/${linkId}`, {
      method: 'POST',
      headers: { Cookie: authCookie },
    });
    assert(revokeRes.ok, 'Owner revokes share link via /api/share/revoke/[id]');

    // Check subsequent access
    const postCheck = await fetch(`${BASE_URL}/api/share/${token}`);
    const postData = await postCheck.json();
    assert(postCheck.status === 403, 'Access to revoked link returns 403 Forbidden');
    assert(postData.status === 'REVOKED', 'Status correctly returns REVOKED');
  } catch (err) {
    assert(false, 'Revoke link test failed', err.message);
  }

  // 8. Test Concurrent Race Condition Handling (Atomic Locks)
  console.log('\n--- 6. Testing Race Condition Concurrency (5 Simultaneous Requests) ---');
  try {
    // Create fresh one-time note
    const raceNoteRes = await fetch(`${BASE_URL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        title: 'High Concurrency Race Test',
        content: 'Only one thread can view this one-time note!',
        share_type: 'ONE_TIME',
        access_type: 'PUBLIC',
      }),
    });
    const raceData = await raceNoteRes.json();
    const raceToken = raceData.shareLink.token;

    // Send 5 requests simultaneously with Promise.all
    const promises = Array.from({ length: 5 }, () =>
      fetch(`${BASE_URL}/api/share/${raceToken}`).then(async (res) => ({
        status: res.status,
        body: await res.json(),
      }))
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.status === 200 && r.body.status === 'PUBLIC_AVAILABLE');
    const rejected = results.filter((r) => r.status === 410 && r.body.status === 'ALREADY_USED');

    console.log(`Concurrency Results: ${successes.length} success, ${rejected.length} already_used`);
    assert(successes.length === 1, 'Exactly ONE request succeeds under concurrent race condition');
    assert(rejected.length === 4, 'Remaining concurrent requests cleanly receive 410 ALREADY_USED');
  } catch (err) {
    assert(false, 'Race condition test failed', err.message);
  }

  // Summary
  console.log('\n=======================================');
  if (failures === 0) {
    console.log('🎉 ALL TESTS PASSED! Project is 100% compliant with requirements.');
  } else {
    console.error(`⚠️ ${failures} tests failed. Please review above logs.`);
  }
  console.log('=======================================\n');
}

runTests();
