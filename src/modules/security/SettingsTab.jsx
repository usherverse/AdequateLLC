import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { 
  Lock, ShieldCheck, Zap, Bell, Landmark, Settings as SettingsIcon, 
  Smartphone, Fingerprint, Palette, Mail, MessageSquare, Globe, 
  ChevronRight, Save, User, CreditCard, Activity, Layers, AlertCircle,
  Eye, EyeOff, KeyRound, ShieldAlert, CheckCircle, Check
} from 'lucide-react';
import { 
  T, Card, CH, Btn, FI, PhoneInput, NumericInput, Alert, Badge, Av,
  useToast, SFX, now, sbWrite, sbAuditInsert, getSecConfig, saveSecConfig,
  checkPwAsync, hashPwAsync, DEFAULT_ADMIN_PW
} from '@/lms-common';

const SettingsTab = ({ adminUser, setAdminUser, auditLog, addAudit, showToast, theme }) => {
  const [activeTab, setActiveTab] = useState('account');
  const [verified, setVerified] = useState(false); // Authentication gate for sensitive tabs
  const [verifyPw, setVerifyPw] = useState('');
  const [verifyErr, setVerifyErr] = useState('');

  // Local state for configuration (synchronized with system_settings later)
  const [cfg, setCfgState] = useState(() => ({
    ...getSecConfig(),
    daily_rate: 0.012,
    interest_days: 30,
    penalty_days: 30,
    freeze_after: 60,
    currency: 'KES',
    appName: 'Adequate Capital',
    primaryColor: '#00D4AA',
    supportEmail: 'support@adequate-llc.com'
  }));

  const saveCfg = (patch) => {
    const next = { ...cfg, ...patch };
    setCfgState(next);
    saveSecConfig(next);
  };

  const doVerify = async () => {
    const latestCfg = getSecConfig();
    const stored = latestCfg.adminPwHash;
    let ok = false;
    try {
      if (!stored) ok = verifyPw === DEFAULT_ADMIN_PW;
      else ok = await checkPwAsync(verifyPw, stored);
    } catch (e) {
      ok = verifyPw === DEFAULT_ADMIN_PW;
    }

    if (ok) {
      setVerified(true);
      setVerifyPw('');
      setVerifyErr('');
      SFX.login();
    } else {
      setVerifyErr('Invalid Master Password');
      SFX.error();
    }
  };

  const tabs = [
    { id: 'account', l: 'Identity', i: User, c: T.blue },
    { id: 'security', l: 'Security', i: Lock, c: T.danger },
    { id: 'fintech', l: 'Fintech Engine', i: Landmark, c: T.gold },
    { id: 'integrations', l: 'Connected Services', i: Zap, c: T.purple },
    { id: 'appearance', l: 'Branding', i: Palette, c: T.accent },
    { id: 'checklist', l: 'Launch Checklist', i: CheckCircle, c: T.ok }
  ];

  const [checklist, setChecklist] = useState([
     { id: 1, task: 'Verify Super Admin Identity', done: true },
     { id: 2, task: 'Harden RLS Policies', done: true },
     { id: 3, task: 'Test M-Pesa Webhook Security', done: false },
     { id: 4, task: 'Apply SSL Certificate', done: false },
     { id: 5, task: 'Audit Initial Loan Products', done: false },
     { id: 6, task: 'Verify Static KYC Document Storage', done: true },
  ]);

  const toggleCheck = (id) => {
     setChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
     SFX.save();
  };

  const SidebarItem = ({ tab }) => {
    const active = activeTab === tab.id;
    return (
      <button 
        onClick={() => setActiveTab(tab.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px',
          borderRadius: 14, border: 'none', textAlign: 'left', cursor: 'pointer',
          background: active ? `${tab.c}15` : 'transparent',
          color: active ? tab.c : T.dim,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          marginBottom: 4, transform: active ? 'translateX(4px)' : 'none'
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10, background: active ? tab.c : T.card2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#000' : T.muted,
          transition: 'inherit', boxShadow: active ? `0 4px 12px ${tab.c}40` : 'none'
        }}>
          <tab.i size={16} strokeWidth={2.5} />
        </div>
        <span style={{ fontWeight: active ? 800 : 600, fontSize: 13.5 }}>{tab.l}</span>
        {active && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
      </button>
    );
  };

  const Section = ({ title, sub, children }) => (
    <div style={{ marginBottom: 32 }}>
       <div style={{ marginBottom: 20 }}>
         <h3 style={{ fontSize: 17, fontWeight: 900, color: T.txt, letterSpacing: '-0.01em' }}>{title}</h3>
         <p style={{ fontSize: 13, color: T.dim, fontWeight: 500, marginTop: 4 }}>{sub}</p>
       </div>
       {children}
    </div>
  );

  return (
    <div className="fu">
      <div style={{ display: 'flex', gap: 32, minHeight: '80vh' }}>
        
        {/* Navigation Sidebar */}
        <div style={{ width: 260, flexShrink: 0 }}>
           <div style={{ padding: '0 8px 24px' }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>Settings</h2>
              <p style={{ fontSize: 13, color: T.dim, fontWeight: 600 }}>Configure your fintech environment</p>
           </div>
           {tabs.map(t => <SidebarItem key={t.id} tab={t} />)}
           
           <div style={{ marginTop: 40, padding: 16, borderRadius: 20, background: T.card2, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                 <ShieldCheck size={16} color={T.ok} />
                 <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: T.ok, letterSpacing: 1 }}>System Status</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: T.dim }}>Environment</span>
                    <Badge v="ok">PROD v2.4</Badge>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: T.dim }}>Last Audit</span>
                    <span style={{ color: T.txt }}>{now()}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, minWidth: 0 }}>
           
           {/* Tab: Account */}
           {activeTab === 'account' && (
             <div className="pop-in">
                <Section title="Owner Identity" sub="Manage your administrative credentials and display profile.">
                   <Card style={{ padding: 24 }}>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 28 }}>
                         <Av ini={adminUser.ini} size={80} color={T.accent} />
                         <div>
                            <Btn v="secondary" sm>Upload Photo</Btn>
                            <p style={{ fontSize: 11, color: T.dim, marginTop: 8, fontWeight: 600 }}>JPG, PNG or GIF. Max size 2MB.</p>
                         </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                         <FI label="Public Display Name" value={adminUser.name} onChange={v => setAdminUser(u => ({...u, name: v}))} />
                         <FI label="System Role" value={adminUser.role} onChange={v => setAdminUser(u => ({...u, role: v}))} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                         <FI label="Primary Work Email" value={cfg.adminEmail || ''} onChange={v => saveCfg({ adminEmail: v })} />
                         <PhoneInput label="Authorized Login Phone" value={cfg.adminPhone || ''} onChange={v => saveCfg({ adminPhone: v })} />
                      </div>
                      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
                         <Btn v="accent" onClick={() => { addAudit('Profile Update', 'Admin'); showToast('✅ Identity saved', 'ok'); }}>Save Changes</Btn>
                      </div>
                   </Card>
                </Section>
             </div>
           )}

           {/* Tab: Fintech */}
           {activeTab === 'fintech' && (
             <div className="pop-in">
                <Section title="Interest & Penalty Architecture" sub="Define the arithmetic rules for automated loan calculations.">
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                      <Card style={{ padding: 20 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.accent}15`, color: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={18}/></div>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>Interest Engine</span>
                         </div>
                         <FI label="Daily Interest Rate (%)" type="number" step="0.001" value={cfg.daily_rate * 100} onChange={v => saveCfg({ daily_rate: v/100 })} hint="Accumulated daily on outstanding balances." />
                         <div style={{ marginTop: 16 }}>
                            <FI label="Interest Grace Period (Days)" type="number" value={cfg.interest_days} onChange={v => saveCfg({ interest_days: v })} hint="No interest is charged for first X days." />
                         </div>
                      </Card>

                      <Card style={{ padding: 20 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.danger}15`, color: T.danger, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShieldAlert size={18}/></div>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>Collection & Penalties</span>
                         </div>
                         <FI label="Penalty Start (Days)" type="number" value={cfg.penalty_days} onChange={v => saveCfg({ penalty_days: v })} hint="Days after disbursement when daily penalty kicks in." />
                         <div style={{ marginTop: 16 }}>
                            <FI label="Write-off Threshold (Days)" type="number" value={cfg.freeze_after} onChange={v => saveCfg({ freeze_after: v })} hint="Loans are auto-frozen/written-off after X days." />
                         </div>
                      </Card>
                   </div>

                   <Card style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '16px 20px', background: T.card2, borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>Loan Products</span>
                            <p style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>Define active loan tiers available for disbursement.</p>
                         </div>
                         <Btn v="secondary" sm>+ Create Tier</Btn>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                         <thead>
                            <tr style={{ textAlign: 'left', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
                               {['Product Name', 'Base Rate', 'Daily Rate', 'Status'].map(h => <th key={h} style={{ padding: '12px 20px', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: T.dim }}>{h}</th>)}
                            </tr>
                         </thead>
                         <tbody>
                            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                               <td style={{ padding: '16px 20px', fontWeight: 700, fontSize: 13 }}>Standard Silver</td>
                               <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600 }}>30.0%</td>
                               <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600 }}>1.2% / day</td>
                               <td style={{ padding: '16px 20px' }}><Badge v="ok">Active</Badge></td>
                            </tr>
                            <tr>
                               <td style={{ padding: '16px 20px', fontWeight: 700, fontSize: 13 }}>Express Emergency</td>
                               <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600 }}>20.0%</td>
                               <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600 }}>2.5% / day</td>
                               <td style={{ padding: '16px 20px' }}><Badge v="warn">Maintenance</Badge></td>
                            </tr>
                         </tbody>
                      </table>
                   </Card>
                </Section>
             </div>
           )}

           {/* Tab: Appearance */}
           {activeTab === 'appearance' && (
             <div className="pop-in">
                <Section title="White-labeling & UI" sub="Customize the look and feel of your admin portal.">
                   <Card style={{ padding: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 40 }}>
                         <div>
                            <FI label="Application Brand Name" value={cfg.appName} onChange={v => saveCfg({ appName: v })} />
                            <div style={{ marginTop: 24 }}>
                               <label style={{ fontSize: 12, fontWeight: 800, color: T.dim, marginBottom: 8, display: 'block' }}>Primary Brand Color</label>
                               <div style={{ display: 'flex', gap: 10 }}>
                                  <input type="color" value={cfg.primaryColor} onChange={e => saveCfg({ primaryColor: e.target.value })} style={{ width: 44, height: 44, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4, background: T.card2, cursor: 'pointer' }} />
                                  <input type="text" value={cfg.primaryColor} onChange={e => saveCfg({ primaryColor: e.target.value })} style={{ flex: 1, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '0 16px', color: T.txt, fontWeight: 700, fontSize: 14 }} />
                               </div>
                            </div>
                         </div>
                         <div style={{ background: T.card2, borderRadius: 20, padding: 20, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 900, color: T.muted, textTransform: 'uppercase' }}>Theme Preview</span>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               <div style={{ width: '100%', height: 120, background: T.bg, borderRadius: 14, border: `3px solid ${cfg.primaryColor}40`, padding: 16 }}>
                                  <div style={{ width: 40, height: 8, background: cfg.primaryColor, borderRadius: 4, marginBottom: 8 }} />
                                  <div style={{ width: 80, height: 4, background: T.hi, borderRadius: 2, marginBottom: 4 }} />
                                  <div style={{ width: 60, height: 4, background: T.hi, borderRadius: 2 }} />
                               </div>
                            </div>
                            <p style={{ fontSize: 11, color: T.muted, textAlign: 'center' }}>Real-time preview of your brand application.</p>
                         </div>
                      </div>
                   </Card>
                </Section>
             </div>
           )}

           {/* Tab: Security (Gated) */}
           {activeTab === 'security' && (
             <div className="pop-in">
                {!verified ? (
                  <Card style={{ padding: 40, textAlign: 'center', border: `2px solid ${T.danger}20`, background: `${T.danger}05` }}>
                     <div style={{ width: 64, height: 64, borderRadius: 20, background: `${T.danger}15`, color: T.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Lock size={32} />
                     </div>
                     <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Restricted Access</h3>
                     <p style={{ fontSize: 13, color: T.dim, fontWeight: 500, marginBottom: 24 }}>Changing security protocols requires verification.</p>
                     
                     <div style={{ maxWidth: 300, margin: '0 auto' }}>
                        <input 
                           type="password" 
                           placeholder="Master Admin Password" 
                           value={verifyPw}
                           onChange={e => setVerifyPw(e.target.value)}
                           onKeyDown={e => e.key === 'Enter' && doVerify()}
                           style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: `1px solid ${verifyErr ? T.danger : T.border}`, background: T.surface, color: T.txt, marginBottom: 12, textAlign: 'center' }}
                        />
                        {verifyErr && <div style={{ color: T.danger, fontSize: 11, fontWeight: 700, marginBottom: 12 }}>⚠ {verifyErr}</div>}
                        <Btn v="danger" full onClick={doVerify}>Authenticate</Btn>
                     </div>
                  </Card>
                ) : (
                  <div className="pop-in">
                     <Section title="Multi-Factor & Identity" sub="Strengthen your portal defense with standard and biometric MFA.">
                        <Card style={{ padding: 24, marginBottom: 24 }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                              <div style={{ width: 48, height: 48, borderRadius: 12, background: cfg.otpEnabled ? `${T.ok}15` : T.card2, color: cfg.otpEnabled ? T.ok : T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Smartphone /></div>
                              <div style={{ flex: 1 }}>
                                 <div style={{ fontWeight: 800, fontSize: 15 }}>2-Step Verification (OTP)</div>
                                 <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Secure every login with a code sent to your phone.</div>
                              </div>
                              <button onClick={() => saveCfg({ otpEnabled: !cfg.otpEnabled })} style={{ cursor: 'pointer', background: cfg.otpEnabled ? T.accent : T.card2, border: 'none', width: 50, height: 26, borderRadius: 20, position: 'relative', transition: '0.3s' }}>
                                 <div style={{ position: 'absolute', top: 3, left: cfg.otpEnabled ? 26 : 4, width: 20, height: 20, background: '#000', borderRadius: '50%', transition: '0.3s' }} />
                              </button>
                           </div>
                        </Card>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                           <Card style={{ padding: 20 }}>
                              <CH title="Credential Rotation" sub="Update your access password" />
                              <div style={{ marginTop: 12 }}>
                                 <Btn v="secondary" full>Change Password Now</Btn>
                              </div>
                           </Card>
                           <Card style={{ padding: 20 }}>
                              <CH title="Platform Access" sub="Session security controls" />
                              <div style={{ marginTop: 12 }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>Auto-Logout</span>
                                    <Badge v="info">15 min</Badge>
                                 </div>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>IP Restriction</span>
                                    <Badge v="warn">Inactive</Badge>
                                 </div>
                              </div>
                           </Card>
                        </div>
                     </Section>
                  </div>
                )}
             </div>
           )}

           {/* Tab: Integrations */}
           {activeTab === 'integrations' && (
             <div className="pop-in">
                <Section title="M-Pesa Gateway Config" sub="Manage B2C and C2B shortcodes and webhook synchronization.">
                   <Card style={{ padding: 24, marginBottom: 24 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                         <FI label="Production B2C Shortcode" value={cfg.b2c_shortcode || '600000'} />
                         <FI label="Production C2B Shortcode" value={cfg.c2b_shortcode || '700000'} />
                      </div>
                      <div style={{ marginTop: 24 }}>
                         <FI label="Webhook Callback URL" value="https://api.adequate-llc.com/mpesa/webhook/v1" readOnly hint="Static endpoint for payment notifications." />
                      </div>
                   </Card>

                   <Card style={{ padding: 0 }}>
                      <div style={{ padding: 16, borderBottom: `1px solid ${T.border}`, fontWeight: 800, fontSize: 14 }}>Connection Health</div>
                      <div style={{ padding: 16 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: T.surface }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.ok, boxShadow: `0 0 10px ${T.ok}aa` }} />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Safaricom G2 Gateway</span>
                            <Badge v="ok">18ms Latency</Badge>
                         </div>
                      </div>
                   </Card>
                </Section>
             </div>
           )}

           {/* Tab: Checklist */}
           {activeTab === 'checklist' && (
             <div className="pop-in">
                <Section title="Production Launch Readiness" sub="Verify all critical gates before public onboarding.">
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                      {checklist.map(item => (
                         <div 
                           key={item.id} 
                           onClick={() => toggleCheck(item.id)}
                           style={{ 
                             padding: '16px 20px', background: item.done ? `${T.ok}10` : T.card2, 
                             border: `1px solid ${item.done ? T.ok : T.border}`, 
                             borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                             transition: 'all 0.2s', transform: item.done ? 'none' : 'scale(1)'
                           }}
                         >
                            <div style={{ 
                               width: 24, height: 24, borderRadius: 8, background: item.done ? T.ok : T.surface, 
                               display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.done ? '#000' : 'transparent',
                               border: `2px solid ${item.done ? T.ok : T.border}`
                            }}>
                               {item.done && <Check size={16} strokeWidth={4} />}
                            </div>
                            <span style={{ 
                               flex: 1, fontSize: 14, fontWeight: 700, 
                               color: item.done ? T.txt : T.dim,
                               textDecoration: item.done ? 'line-through' : 'none',
                               opacity: item.done ? 0.6 : 1
                            }}>
                               {item.task}
                            </span>
                            {item.done && <Badge v="ok">Verified</Badge>}
                         </div>
                      ))}
                   </div>
                   
                   <Card style={{ marginTop: 32, padding: 24, textAlign: 'center', border: `1px solid ${T.accent}30`, background: `${T.accent}05` }}>
                      <h4 style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>Ready for Launch?</h4>
                      <p style={{ fontSize: 13, color: T.dim, fontWeight: 600, marginBottom: 20 }}>All critical security markers must be green before the public domain is mapped.</p>
                      <Btn v="accent" disabled={checklist.some(i => !i.done)}>Go Live — Initiate Production Environment</Btn>
                   </Card>
                </Section>
             </div>
           )}
        </div>

      </div>

      <style>{`
        .pop-in { animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.98) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SettingsTab;
