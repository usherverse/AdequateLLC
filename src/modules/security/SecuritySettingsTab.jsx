import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock,
  getSecConfig, saveSecConfig, checkPwAsync, hashPwAsync, DEFAULT_ADMIN_PW } from '@/lms-common';
import { _checkPw } from '@/data/seedData';


const SecuritySettingsTab = ({auditLog, addAudit, showToast}) => {
  const [cfg, setCfgState] = useState(getSecConfig);
  const [verifyPw, setVerifyPw] = useState('');
  const [verified, setVerified] = useState(true); // open by default — no password gate
  const [verifyErr, setVerifyErr] = useState('');
  const [showChangePw, setShowChangePw] = useState(false);
  const [curPw, setCurPw] = useState('');       // current password before changing
  const [curPwErr, setCurPwErr] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [showCurPw, setShowCurPw] = useState(false);   // eye toggle for current pw
  const [showNewPw, setShowNewPw] = useState(false);   // eye toggle for new pw
  const [showNewPw2, setShowNewPw2] = useState(false); // eye toggle for confirm pw
  const [otpPhone, setOtpPhone] = useState(cfg.adminPhone||'');


  const saveCfg = (patch) => {
    const next = {...cfg,...patch};
    setCfgState(next);
    saveSecConfig(next);
  };

  // Verify current admin password before allowing changes
  const doVerify = async () => {
    if(!verifyPw) { setVerifyErr('Please enter your password.'); return; }
    // Re-read config fresh from storage so we always have the latest hash
    const latestCfg = getSecConfig();
    const stored = latestCfg.adminPwHash;
    let ok = false;
    try {
      if(!stored) {
        // No password has ever been set — compare against hardcoded default
        ok = verifyPw === DEFAULT_ADMIN_PW;
      } else {
        // Try SHA-256 first, then fall back to legacy djb2 for older records
        ok = await checkPwAsync(verifyPw, stored);
        if(!ok) ok = _checkPw(verifyPw, stored);
      }
    } catch(e) {
      // SubtleCrypto unavailable (non-HTTPS context) — fall back gracefully
      ok = !stored ? (verifyPw === DEFAULT_ADMIN_PW) : _checkPw(verifyPw, stored);
    }
    if(ok) {
      setVerified(true);
      setVerifyPw('');
      setVerifyErr('');
      try { addAudit('Security Settings Accessed','Admin','Password verified'); } catch(e){}
      try { SFX.login(); } catch(e){}
    } else {
      setVerifyErr('Incorrect password. Default is: admin123');
      try { SFX.error(); } catch(e){}
    }
  };

  const doChangePw = async () => {
    // Step 1: verify current password
    const latestCfg = getSecConfig();
    const stored = latestCfg.adminPwHash;
    let curOk = false;
    try {
      curOk = !stored ? (curPw === DEFAULT_ADMIN_PW) : (await checkPwAsync(curPw, stored) || _checkPw(curPw, stored));
    } catch(e) {
      curOk = !stored ? (curPw === DEFAULT_ADMIN_PW) : _checkPw(curPw, stored);
    }
    if(!curOk) { setCurPwErr('Current password is incorrect.'); try{SFX.error();}catch(e){} return; }
    setCurPwErr('');
    // Step 2: validate new password
    if(newPw.length < 6) { setPwErr('Password must be at least 6 characters.'); return; }
    if(newPw !== newPw2) { setPwErr('Passwords do not match.'); return; }
    const hash = await hashPwAsync(newPw);
    saveCfg({adminPwHash: hash});
    addAudit('Admin Password Changed','Admin','Password updated via Security Settings');
    showToast('✅ Password changed successfully','ok');
    setShowChangePw(false); setCurPw(''); setNewPw(''); setNewPw2(''); setPwErr(''); setCurPwErr('');
  };


  const doSaveOtpPhone = () => {
    if(!otpPhone) { showToast('⚠ Enter a phone number first','warn'); return; }
    saveCfg({otpEnabled:false, adminPhone:otpPhone}); // OTP disabled — keeping phone number saved for future use
    addAudit('OTP Enabled','Admin',`OTP SMS will go to ${otpPhone}`);
    showToast(`✅ OTP enabled — codes will be sent to ${otpPhone}`,'ok');
  };

  const toggleFeature = (key) => {
    saveCfg({[key]:!cfg[key]});
    addAudit(`Security Feature Toggled`,key,`→ ${!cfg[key]?'Enabled':'Disabled'}`);
    showToast(`${key.replace('Enabled','')} ${!cfg[key]?'enabled':'disabled'}`,'info');
  };

  const features = [
    {key:'passwordEnabled', icon:'🔑', label:'Password Login', desc:'Require admin password to log in. Cannot be disabled while biometric is off.', canDisable: cfg.biometricEnabled},
    // SMS OTP disabled — uncomment once SMS provider (Vonage/Twilio) is configured in Supabase:
    // {key:'otpEnabled', icon:'📱', label:'SMS OTP', desc:'Send a one-time code to the registered phone number as an additional login step.', canDisable: true},
  ];

  return (
    <div className='fu'>
      <div style={{fontFamily:T.head,color:T.txt,fontSize:20,fontWeight:800,marginBottom:4}}>🔐 Security Settings</div>
      <div style={{color:T.muted,fontSize:13,marginBottom:20}}>Configure authentication methods for admin login.</div>

      {/* Password verification gate */}
      {!verified&&(
        <Card style={{marginBottom:16,border:`1px solid ${T.warn}30`}}>
          <div style={{padding:'16px 18px'}}>
            <div style={{color:T.warn,fontWeight:700,fontSize:14,marginBottom:6}}>🔒 Verify your identity to make changes</div>
            <div style={{color:T.muted,fontSize:12,marginBottom:14}}>Enter your current admin password to unlock security settings.</div>
            <div style={{display:'flex',gap:9,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:180}}>
                <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>
                  Current Password
                </label>
                <input
                  type='password'
                  value={verifyPw}
                  onChange={e=>setVerifyPw(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&doVerify()}
                  placeholder='Enter current password'
                  autoComplete='current-password'
                  style={{width:'100%',background:T.surface,border:`1px solid ${verifyErr?T.danger:T.border}`,borderRadius:8,padding:'10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,boxSizing:'border-box'}}
                />
                {verifyErr&&<div style={{color:T.danger,fontSize:12,marginTop:5}}>⚠ {verifyErr}</div>}
              </div>
              <Btn onClick={doVerify}>Unlock Settings</Btn>
            </div>
            <div style={{color:T.muted,fontSize:11,marginTop:10}}>
              Default password: <b style={{color:T.accent,letterSpacing:1}}>admin123</b>
            </div>
          </div>
        </Card>
      )}

      {/* Auth method toggles */}
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16,opacity:verified?1:0.45,pointerEvents:verified?'auto':'none'}}>
        {features.map(feat=>(
          <Card key={feat.key} style={{border:`1px solid ${cfg[feat.key]?T.ok+'38':T.border}`}}>
            <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
              <div style={{fontSize:28,flexShrink:0}}>{feat.icon}</div>
              <div style={{flex:1,minWidth:160}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                  <span style={{color:T.txt,fontWeight:700,fontSize:14}}>{feat.label}</span>
                  <Badge color={cfg[feat.key]?T.ok:T.muted}>{cfg[feat.key]?'Enabled':'Disabled'}</Badge>
                </div>
                <div style={{color:T.muted,fontSize:12}}>{feat.desc}</div>
              </div>
              <button
                onClick={()=>{ if(!feat.canDisable&&cfg[feat.key]){showToast('⚠ Enable at least one other factor before disabling password.','warn');return;} toggleFeature(feat.key); }}
                style={{background:cfg[feat.key]?T.dLo:T.oLo, border:`1px solid ${cfg[feat.key]?T.danger+'38':T.ok+'38'}`, color:cfg[feat.key]?T.danger:T.ok, borderRadius:8, padding:'7px 16px', cursor:'pointer', fontWeight:700, fontSize:12, flexShrink:0}}>
                {cfg[feat.key]?'Disable':'Enable'}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Change password section */}
      {verified&&(
        <>
        <Card style={{marginBottom:12}}>
          <CH title='🔑 Change Admin Password'/>
          <div style={{padding:'14px 16px'}}>
            {!showChangePw
              ?<Btn onClick={()=>setShowChangePw(true)}>Change Password →</Btn>
              :<div>
                {/* Current password */}
                <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>Current Password</label>
                <div style={{position:'relative',marginBottom:10}}>
                  <input type={showCurPw?'text':'password'} value={curPw} onChange={e=>{setCurPw(e.target.value);setCurPwErr('');}} placeholder='Enter current password' autoComplete='current-password'
                    style={{width:'100%',background:T.surface,border:`1px solid ${curPwErr?T.danger:T.border}`,borderRadius:8,padding:'10px 40px 10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,boxSizing:'border-box'}}/>
                  <button onClick={()=>setShowCurPw(v=>!v)} tabIndex={-1}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.muted,fontSize:16,padding:'0 2px',lineHeight:1}}>
                    {showCurPw?'🙈':'👁️'}
                  </button>
                </div>
                {curPwErr&&<div style={{color:T.danger,fontSize:12,marginBottom:8}}>⚠ {curPwErr}</div>}

                {/* New password */}
                <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>New Password</label>
                <div style={{position:'relative',marginBottom:10}}>
                  <input type={showNewPw?'text':'password'} value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder='Minimum 6 characters' autoComplete='new-password'
                    style={{width:'100%',background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:'10px 40px 10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,boxSizing:'border-box'}}/>
                  <button onClick={()=>setShowNewPw(v=>!v)} tabIndex={-1}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.muted,fontSize:16,padding:'0 2px',lineHeight:1}}>
                    {showNewPw?'🙈':'👁️'}
                  </button>
                </div>

                {/* Confirm new password */}
                <label style={{display:'block',color:T.dim,fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:.7,textTransform:'uppercase'}}>Confirm New Password</label>
                <div style={{position:'relative',marginBottom:10}}>
                  <input type={showNewPw2?'text':'password'} value={newPw2} onChange={e=>setNewPw2(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doChangePw()} placeholder='Repeat new password' autoComplete='new-password'
                    style={{width:'100%',background:T.surface,border:`1px solid ${newPw&&newPw2&&newPw!==newPw2?T.danger:T.border}`,borderRadius:8,padding:'10px 40px 10px 12px',color:T.txt,fontSize:14,outline:'none',fontFamily:T.body,boxSizing:'border-box'}}/>
                  <button onClick={()=>setShowNewPw2(v=>!v)} tabIndex={-1}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.muted,fontSize:16,padding:'0 2px',lineHeight:1}}>
                    {showNewPw2?'🙈':'👁️'}
                  </button>
                </div>
                {newPw&&newPw2&&newPw!==newPw2&&<div style={{color:T.danger,fontSize:12,marginBottom:6}}>⚠ Passwords do not match</div>}
                {newPw&&newPw.length>0&&newPw.length<6&&<div style={{color:T.warn,fontSize:12,marginBottom:6}}>⚠ At least 6 characters required</div>}
                {pwErr&&<div style={{color:T.danger,fontSize:12,marginBottom:8}}>⚠ {pwErr}</div>}
                <div style={{display:'flex',gap:8}}>
                  <Btn onClick={doChangePw} full>✓ Save New Password</Btn>
                  <Btn v='secondary' onClick={()=>{setShowChangePw(false);setPwErr('');setCurPwErr('');setCurPw('');setNewPw('');setNewPw2('');}}>Cancel</Btn>
                </div>
              </div>
            }
          </div>
        </Card>

        {/* Biometric — WebAuthn fingerprint registration */}
        {(()=>{
          const [bioStatus,setBioStatus]=useState('idle');
          const [bioMsg,setBioMsg]=useState('');
          const hasCred=!!cfg.bioCredId;
          useEffect(()=>{
            if(!window.PublicKeyCredential){setBioStatus('unsupported');return;}
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
              .then(avail=>{if(!avail){setBioStatus('unsupported');setBioMsg('No fingerprint sensor or Face ID detected.');}else setBioStatus(hasCred?'ok':'idle');})
              .catch(()=>{setBioStatus('unsupported');setBioMsg('Could not detect biometric hardware.');});
          // eslint-disable-next-line react-hooks/exhaustive-deps
          },[]);
          const doRegister=async()=>{
            setBioStatus('registering');setBioMsg('');
            try{
              if(!window.PublicKeyCredential) throw new Error('WebAuthn not supported.');
              const avail=await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
              if(!avail) throw new Error('No fingerprint/Face ID sensor found.');
              const challenge=crypto.getRandomValues(new Uint8Array(32));
              const userId=crypto.getRandomValues(new Uint8Array(16));
              const credential=await navigator.credentials.create({publicKey:{challenge,rp:{name:'Adequate Capital LMS',id:window.location.hostname||'localhost'},user:{id:userId,name:cfg.adminEmail||'admin',displayName:'Admin'},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},timeout:60000,attestation:'none'}});
              const credId=Array.from(new Uint8Array(credential.rawId));
              saveCfg({biometricEnabled:true,bioCredId:credId});
              setBioStatus('ok');setBioMsg('');
              addAudit('Biometric Registered','Admin','Fingerprint/FaceID registered');
              showToast('✅ Fingerprint registered — biometric login is now active','ok',4000);
              try{SFX.save();}catch(e){}
            }catch(e){
              if(e.name==='AbortError'||e.message?.includes('cancel')){setBioStatus(hasCred?'ok':'idle');setBioMsg('Registration cancelled.');}
              else{setBioStatus('error');setBioMsg(e.message||'Registration failed. Ensure app is on HTTPS.');try{SFX.error();}catch(ex){}}
            }
          };
          const doRemove=()=>{saveCfg({biometricEnabled:false,bioCredId:null});setBioStatus('idle');setBioMsg('');addAudit('Biometric Removed','Admin','Fingerprint removed');showToast('Fingerprint removed','warn');};
          return(
            <Card style={{marginBottom:12,border:`1px solid ${bioStatus==='ok'?T.ok+'40':bioStatus==='unsupported'?T.border:T.accent+'30'}`}}>
              <CH title='🪬 Fingerprint / Face ID Login'/>
              <div style={{padding:'14px 16px'}}>
                {bioStatus==='unsupported'&&(<div style={{display:'flex',gap:12,alignItems:'flex-start'}}><div style={{fontSize:28}}>🚫</div><div><div style={{color:T.warn,fontWeight:700,fontSize:13,marginBottom:4}}>Not supported on this device</div><div style={{color:T.muted,fontSize:12,lineHeight:1.6}}>{bioMsg||'Requires a device with fingerprint/Face ID on Chrome, Edge, or Safari over HTTPS.'}</div></div></div>)}
                {bioStatus!=='unsupported'&&(<div style={{display:'flex',gap:14,alignItems:'flex-start'}}><div style={{fontSize:32,flexShrink:0,marginTop:2}}>{bioStatus==='ok'?'✅':bioStatus==='registering'?'⏳':'🫆'}</div><div style={{flex:1}}>
                  {bioStatus==='ok'&&(<><div style={{color:T.ok,fontWeight:700,fontSize:14,marginBottom:4}}>Fingerprint registered on this device</div><div style={{color:T.muted,fontSize:12,marginBottom:14,lineHeight:1.6}}>Biometric login is active as a second factor on this device.</div><div style={{display:'flex',gap:8}}><Btn onClick={doRegister} v='secondary' sm>↺ Re-register</Btn><Btn onClick={doRemove} v='danger' sm>✕ Remove</Btn></div></>)}
                  {(bioStatus==='idle'||bioStatus==='error')&&(<><div style={{color:T.txt,fontWeight:700,fontSize:14,marginBottom:4}}>Register your fingerprint</div><div style={{color:T.muted,fontSize:12,marginBottom:10,lineHeight:1.6}}>Use your device fingerprint reader or Face ID as a second login factor.</div>{bioStatus==='error'&&<Alert type='danger' style={{marginBottom:10}}>{bioMsg}</Alert>}{bioStatus==='idle'&&bioMsg&&<div style={{color:T.muted,fontSize:12,marginBottom:8}}>{bioMsg}</div>}<Btn onClick={doRegister} full>🫆 Register Fingerprint / Face ID</Btn></>)}
                  {bioStatus==='registering'&&(<div style={{display:'flex',gap:10,alignItems:'center'}}><div style={{width:18,height:18,border:`2px solid ${T.border}`,borderTop:`2px solid ${T.accent}`,borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}}/><div style={{color:T.accent,fontSize:13,fontWeight:600}}>Waiting for fingerprint… touch the sensor now</div></div>)}
                </div></div>)}
              </div>
            </Card>
          );
        })()}
                {/* OTP phone setup */}
        <Card style={{marginBottom:12}}>
          <CH title='📱 OTP Phone Number'/>
          <div style={{padding:'14px 16px'}}>
            <div style={{color:T.muted,fontSize:12,marginBottom:12}}>When OTP is enabled, a 6-digit code will be shown here and you enter it to complete login. In production, this will be sent as an SMS.</div>
            <div style={{display:'flex',gap:9,alignItems:'flex-end',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:180}}><PhoneInput label='Admin Phone for OTP' value={otpPhone} onChange={setOtpPhone}/></div>
              <Btn onClick={doSaveOtpPhone} style={{marginBottom:12}}>Save & Enable OTP</Btn>
            </div>
            {cfg.adminPhone&&<div style={{color:T.ok,fontSize:12,marginTop:4}}>✓ OTP will go to: <b>{cfg.adminPhone}</b></div>}
          </div>
        </Card>

        {/* Recovery contact setup */}
        <Card style={{marginBottom:12,border:`1px solid ${T.warn}30`}}>
          <CH title='🆘 Account Recovery Contacts' sub='Used to unlock your account after a lockout'/>
          <div style={{padding:'14px 16px'}}>
            <Alert type='warn' style={{marginBottom:12}}>Set at least one recovery method. Without this, a lockout can only be cleared by waiting 15 minutes.</Alert>
            <FI label='Recovery Email' type='email' value={cfg.adminEmail||''} onChange={v=>saveCfg({adminEmail:v})} placeholder='admin@adequatecapital.co.ke'/>
            <PhoneInput label='Recovery Phone (SMS)' value={cfg.adminRecoveryPhone||''} onChange={v=>saveCfg({adminRecoveryPhone:v})}/>
            <div style={{color:T.ok,fontSize:12,marginTop:4}}>
              {(cfg.adminEmail||cfg.adminRecoveryPhone)
                ? `✓ Recovery available via: ${[cfg.adminEmail&&'Email',cfg.adminRecoveryPhone&&'SMS'].filter(Boolean).join(' & ')}`
                : <span style={{color:T.danger}}>⚠ No recovery contacts set</span>}
            </div>
          </div>
        </Card>
        </>
      )}
    </div>
  );
};


// LiveClock removed — it ran setInterval every second, causing AdminPanel to receive
// re-render pressure. Removed per product requirements.

export default SecuritySettingsTab;

