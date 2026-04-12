import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { KeyRound, Lock, Fingerprint, Ban, CheckCircle, Hourglass, Smartphone, ShieldAlert, Check, AlertTriangle, EyeOff, Eye } from 'lucide-react';
import { T, SC, RC, SFX, Card, CH, KPI, DT, Btn, Badge, Av, Bar, BackBtn, RefreshBtn,
  FI, PhoneInput, NumericInput, Search, Pills, Alert, Dialog, ConfirmDialog, ToastContainer,
  LoanModal, LoanForm, RepayTracker, ModuleHeader,
  fmt, fmtM, now, uid, ts, escHtml, toCSV, dlCSV, buildFullBackup,
  calculateLoanStatus,
  sbWrite, sbInsert,
  toSupabaseLoan, toSupabaseCustomer, toSupabasePayment, toSupabaseInteraction,
  generateLoanAgreementHTML, generateAssetListHTML, downloadLoanDoc,
  useContactPopup, useToast, useReminders, useModalLock,
  getSecConfig, saveSecConfig, checkPwAsync, hashPwAsync, DEFAULT_ADMIN_PW } from '@/lms-common';
import { _checkPw } from '@/data/seedData';


const SecuritySettingsTab = ({ adminUser, setAdminUser, auditLog, addAudit, showToast }) => {
  const [cfg, setCfgState] = useState(getSecConfig);
  const [verifyPw, setVerifyPw] = useState("");
  const [verified, setVerified] = useState(true);
  const [verifyErr, setVerifyErr] = useState("");
  const [showChangePw, setShowChangePw] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [curPwErr, setCurPwErr] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [showCurPw, setShowCurPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showNewPw2, setShowNewPw2] = useState(false);
  const [otpPhone, setOtpPhone] = useState(cfg.adminPhone || "");

  const saveCfg = (patch) => {
    const next = { ...cfg, ...patch };
    setCfgState(next);
    saveSecConfig(next);
  };

  const doVerify = async () => {
    if (!verifyPw) { setVerifyErr("Required"); return; }
    const latestCfg = getSecConfig();
    const stored = latestCfg.adminPwHash;
    let ok = false;
    try {
      if (!stored) ok = verifyPw === DEFAULT_ADMIN_PW;
      else {
        ok = await checkPwAsync(verifyPw, stored);
        if (!ok) ok = _checkPw(verifyPw, stored);
      }
    } catch (e) {
      ok = !stored ? verifyPw === DEFAULT_ADMIN_PW : _checkPw(verifyPw, stored);
    }
    if (ok) {
      setVerified(true);
      setVerifyPw("");
      setVerifyErr("");
      SFX.login();
    } else {
      setVerifyErr("Incorrect password");
      SFX.error();
    }
  };

  const doChangePw = async () => {
    const latestCfg = getSecConfig();
    const stored = latestCfg.adminPwHash;
    let curOk = false;
    try {
      curOk = !stored ? curPw === DEFAULT_ADMIN_PW : (await checkPwAsync(curPw, stored) || _checkPw(curPw, stored));
    } catch (e) {
      curOk = !stored ? curPw === DEFAULT_ADMIN_PW : _checkPw(curPw, stored);
    }
    if (!curOk) { setCurPwErr("Incorrect current password."); SFX.error(); return; }
    if (newPw.length < 6) { setPwErr("Min 6 characters."); return; }
    if (newPw !== newPw2) { setPwErr("No match."); return; }
    const hash = await hashPwAsync(newPw);
    saveCfg({ adminPwHash: hash });
    showToast("✅ Password updated", "ok");
    setShowChangePw(false); setCurPw(""); setNewPw(""); setNewPw2("");
  };

  const toggleFeature = (key) => {
    saveCfg({ [key]: !cfg[key] });
    showToast(`${key.replace("Enabled", "")} ${!cfg[key] ? "enabled" : "disabled"}`, "info");
  };

  return (
    <div className="fu">
      <ModuleHeader 
        title={<><Lock size={22} style={{verticalAlign:'middle', marginRight:10, marginTop:-4}}/> Security & Access</>}
        sub="Protect your account with multi-factor authentication and session controls."
      />

      {!verified && (
        <Card style={{ marginBottom: 24, padding: 24, border: `2px solid ${T.warn}40`, background: `${T.warn}05` }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${T.warn}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.warn }}>
                    <ShieldAlert size={24} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ color: T.txt, fontWeight: 800, fontSize: 16 }}>Authentication Required</div>
                    <div style={{ color: T.muted, fontSize: 13, marginTop: 2 }}>Sensitive settings are locked. Please verify your password.</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                   <input
                        type="password"
                        value={verifyPw}
                        onChange={e => setVerifyPw(e.target.value)}
                        placeholder="Admin Password"
                        style={{ background: T.surface, border: `1px solid ${verifyErr ? T.danger : T.border}`, borderRadius: 10, padding: '10px 14px', color: T.txt, fontSize: 14, outline: 'none' }}
                    />
                    <Btn onClick={doVerify} v="primary">Unlock</Btn>
                </div>
            </div>
            {verifyErr && <div style={{ color: T.danger, fontSize: 11, fontWeight: 700, marginTop: 8, paddingLeft: 64 }}>⚠ {verifyErr}</div>}
        </Card>
      )}

      <div style={{ opacity: verified ? 1 : 0.5, pointerEvents: verified ? 'auto' : 'none' }}>
        
        <Card style={{ marginBottom: 24 }}>
          <CH title="Admin Identity" sub="Manage how you appear in the system and audit logs" />
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            <FI 
              label="Display Name" 
              value={adminUser.name} 
              onChange={v => setAdminUser(u => ({ ...u, name: v, ini: v.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() }))} 
              placeholder="e.g. Don Administrator"
              hint="This name appears in greetings and audit trails."
            />
            <FI 
              label="System Role / Organization" 
              value={adminUser.role} 
              onChange={v => setAdminUser(u => ({ ...u, role: v }))} 
              placeholder="e.g. Super Admin"
              hint="Displayed in your sidebar profile."
            />
          </div>
          <div style={{ padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end' }}>
             <Btn v="accent" onClick={() => { addAudit('Profile Update', 'Admin', `Changed name to ${adminUser.name}`); showToast('✅ Profile updated', 'ok'); }}>Save Identity</Btn>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
          
          <Card>
            <CH title="Authentication Methods" sub="Standard login providers" />
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { key: 'passwordEnabled', icon: <KeyRound />, label: 'Standard Password', desc: 'Secure login via alphanumeric password.', can: cfg.biometricEnabled },
                { key: 'otpEnabled', icon: <Smartphone />, label: '2-Step Verification', desc: 'Require a unique code sent to your device.', can: true }
              ].map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 14, background: T.surface, border: `1px solid ${T.border}` }}>
                  <div style={{ padding: 10, borderRadius: 10, background: cfg[f.key] ? `${T.ok}15` : T.card2, color: cfg[f.key] ? T.ok : T.muted }}>
                    {React.cloneElement(f.icon, { size: 20 })}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: T.txt, fontWeight: 750, fontSize: 14 }}>{f.label}</div>
                    <div style={{ color: T.dim, fontSize: 12 }}>{f.desc}</div>
                  </div>
                  <button 
                    onClick={() => toggleFeature(f.key)}
                    style={{ background: cfg[f.key] ? T.aLo : T.card2, border: 'none', width: 44, height: 24, borderRadius: 20, cursor: 'pointer', position: 'relative', transition: 'all .3s' }}
                  >
                    <div style={{ position: 'absolute', top: 3, left: cfg[f.key] ? 22 : 3, width: 18, height: 18, background: cfg[f.key] ? T.accent : T.muted, borderRadius: '50%', transition: 'all .3s' }} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CH title="Biometrics & Hardware" sub="Fast & secure device access" />
            <div style={{ padding: 20 }}>
                {window.PublicKeyCredential ? (
                    <div style={{ background: T.surface, padding: 16, borderRadius: 14, border: `1px solid ${cfg.bioCredId ? `${T.ok}30` : T.border}`, display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg.bioCredId ? `${T.ok}15` : T.aLo, color: cfg.bioCredId ? T.ok : T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Fingerprint size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: T.txt, fontWeight: 750, fontSize: 14 }}>Fingerprint / FaceID</div>
                            <div style={{ color: T.dim, fontSize: 12 }}>{cfg.bioCredId ? "Hardware key registered." : "Not configured on this device."}</div>
                        </div>
                        {cfg.bioCredId 
                            ? <Btn v="secondary" sm onClick={() => saveCfg({ bioCredId: null, biometricEnabled: false })}>Remove</Btn> 
                            : <Btn v="accent" sm onClick={async () => {
                                try {
                                    const challenge = crypto.getRandomValues(new Uint8Array(32));
                                    const userId = crypto.getRandomValues(new Uint8Array(16));
                                    const credential = await navigator.credentials.create({ publicKey: { challenge, rp: { name: 'Adequate LMS', id: window.location.hostname }, user: { id: userId, name: 'Admin', displayName: 'Admin' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }], authenticatorSelection: { userVerification: 'required' }, timeout: 60000 } });
                                    saveCfg({ bioCredId: Array.from(new Uint8Array(credential.rawId)), biometricEnabled: true });
                                    showToast("✅ Biometric Active", "ok");
                                } catch(e) { showToast("Hardware Error", "danger"); }
                            }}>Setup</Btn>
                        }
                    </div>
                ) : (
                    <Alert type="info">Biometrics unavailable on this browser/connection.</Alert>
                )}
            </div>
          </Card>

        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
            
            <Card>
                <CH title="Recovery Contacts" sub="Secondary access fallbacks" />
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <FI label="Admin Email" type="email" value={cfg.adminEmail || ""} onChange={v => saveCfg({ adminEmail: v })} />
                    <PhoneInput label="Recovery SMS" value={cfg.adminRecoveryPhone || ""} onChange={v => saveCfg({ adminRecoveryPhone: v })} />
                </div>
            </Card>

            <Card>
                <CH title="Password Management" sub="Rotate your access credentials" />
                <div style={{ padding: 20 }}>
                    {!showChangePw ? (
                        <div style={{ textAlign: 'center', padding: '10px 0' }}>
                           <Btn v="secondary" full onClick={() => setShowChangePw(true)}>Change Admin Password</Btn>
                           <div style={{ color: T.dim, fontSize: 11, marginTop: 12 }}>Last rotated: {now()}</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <input type="password" placeholder="Current Password" value={curPw} onChange={e => setCurPw(e.target.value)} style={{ background: T.surface, border: `1px solid ${curPwErr ? T.danger : T.border}`, borderRadius: 10, padding: '10px 14px', color: T.txt }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <input type="password" placeholder="New Password" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', color: T.txt }} />
                                <input type="password" placeholder="Confirm" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={{ background: T.surface, border: `1px solid ${newPw !== newPw2 ? T.danger : T.border}`, borderRadius: 10, padding: '10px 14px', color: T.txt }} />
                            </div>
                            {pwErr && <div style={{ color: T.danger, fontSize: 11 }}>{pwErr}</div>}
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <Btn v="primary" full onClick={doChangePw}>Save</Btn>
                                <Btn v="ghost" onClick={() => setShowChangePw(false)}>Cancel</Btn>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

        </div>
      </div>
    </div>
  );
};

export default SecuritySettingsTab;

