import React, { useState, useRef } from 'react';
import { T, Card, CH, Btn, Badge, KPI, DocViewer, PhoneInput, Alert, compressImage, uid, now, SFX } from '@/lms-common';
import { 
  User, Shield, FileText, Smartphone, Mail, Calendar, Briefcase, Camera, Trash2, 
  Upload as UploadIcon, ExternalLink, ShieldAlert, ShieldCheck, Folder, 
  MoreVertical, Plus, Download, Eye
} from 'lucide-react';

export default function WorkerProfileCard({ worker, setWorkers, addAudit, showToast, initialTab = 'profile', isMobile }) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditing, setIsEditing] = useState(false);
  const [editedW, setEditedW] = useState({...worker});
  const [viewingDoc, setViewingDoc] = useState(null);
  
  const w = worker;

  const saveProfile = () => {
    setWorkers(ws => ws.map(x => x.id === worker.id ? editedW : x));
    
    // Persist to Supabase
    import('@/config/supabaseClient').then(({supabase, DEMO_MODE}) => {
      if(!DEMO_MODE && supabase) {
        const oldName = worker.name;
        const newName = editedW.name;

        supabase.from('workers').update({
          name: newName,
          phone: editedW.phone,
          id_no: editedW.idNo
        }).eq('id', worker.id).then(({error}) => {
          if(error) {
            showToast('Sync failed: ' + error.message, 'danger');
          } else {
            showToast('Profile updated', 'ok');
            
            // PROPAGATED UPDATE: If name changed, rename across the entire portfolio
            if(newName !== oldName) {
              console.log(`[Sync] Propagating name change: ${oldName} -> ${newName}`);
              // Rename in customers
              supabase.from('customers').update({ officer: newName }).eq('officer', oldName).then(() => {});
              supabase.from('customers').update({ assigned_officer: newName }).eq('assigned_officer', oldName).then(() => {});
              // Rename in leads
              supabase.from('leads').update({ officer: newName }).eq('officer', oldName).then(() => {});
              // Rename in loans (for consistent reports)
              supabase.from('loans').update({ officer: newName }).eq('officer', oldName).then(() => {});

              showToast('Portfolio synchronized to new name', 'secondary');
            }
          }
        });
      } else {
        showToast('Profile updated (Local Only)', 'ok');
      }
    });

    addAudit('Profile Updated', worker.id, 'User updated personal details');
    setIsEditing(false);
  };

  const TABS = [
    { id: 'profile', label: 'Identity', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'docs', label: 'Documents', icon: FileText }
  ];

  return (
    <div className="fu">
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8,
              background: activeTab === t.id ? T.accent : T.surface,
              color: activeTab === t.id ? '#000' : T.muted,
              border: `1px solid ${activeTab === t.id ? T.accent : T.border}`,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: '0.2s'
            }}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 20 }}>
           <Card style={{ background: T.surface, position: 'relative', textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: T.accent, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#000', boxShadow: `0 0 30px ${T.accent}30` }}>
                 {w.avatar || (w.name || '').charAt(0)}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.txt }}>{w.name}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{w.role}</div>
              <Badge style={{ marginTop: 12 }} color={w.status === 'Active' ? T.ok : T.danger}>{w.status}</Badge>
              <div style={{ marginTop: 20, borderTop: `1px solid ${T.border}`, paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 13 }}>
                    <Mail size={14} /> {w.email}
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.muted, fontSize: 13 }}>
                    <Smartphone size={14} /> {w.phone || 'No phone'}
                 </div>
              </div>
           </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
               <Card>
                  <CH title="Work Information" icon={Briefcase} right={
                    <Btn sm v={isEditing ? 'ok' : 'secondary'} onClick={() => isEditing ? saveProfile() : setIsEditing(true)}>
                      {isEditing ? 'Save Changes' : 'Edit Profile'}
                    </Btn>
                  } />
                  <div style={{ padding: '0 12px 12px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                     <div>
                        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 700 }}>FULL NAME</div>
                        {isEditing ? (
                          <input value={editedW.name || ''} onChange={e => setEditedW({...editedW, name: e.target.value})} style={{ width: '100%' }} />
                        ) : (
                          <div style={{ color: T.txt, fontWeight: 700 }}>{w.name}</div>
                        )}
                     </div>
                     <div>
                        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 700 }}>PHONE NUMBER</div>
                        {isEditing ? (
                          <input value={editedW.phone || ''} onChange={e => setEditedW({...editedW, phone: e.target.value})} style={{ width: '100%' }} />
                        ) : (
                          <div style={{ color: T.txt, fontWeight: 700 }}>{w.phone || '—'}</div>
                        )}
                     </div>
                     <div>
                        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 700 }}>NATIONAL ID</div>
                        {isEditing ? (
                          <input value={editedW.idNo || ''} onChange={e => setEditedW({...editedW, idNo: e.target.value})} style={{ width: '100%' }} />
                        ) : (
                          <div style={{ color: T.txt, fontWeight: 700 }}>{w.idNo || '—'}</div>
                        )}
                     </div>
                     <div>
                        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 700 }}>JOINED DATE</div>
                        <div style={{ color: T.txt, fontWeight: 700 }}>{w.joined || '—'}</div>
                     </div>
                     <div>
                        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 700 }}>WORKER ID</div>
                        <div style={{ color: T.txt, fontWeight: 700 }}>{String(w.id).toUpperCase()}</div>
                     </div>
                  </div>
               </Card>

               {/* Role Context Card */}
               <Card style={{ background: `linear-gradient(to right, ${T.surface}, ${T.aLo})`, borderLeft: `4px solid ${T.accent}` }}>
                  <CH title="Role Context & Permissions" icon={Shield} />
                  <div style={{ padding: '0 12px 12px' }}>
                     <div style={{ fontSize: 13, fontWeight: 800, color: T.accent, marginBottom: 4 }}>{w.role}</div>
                     <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                        {w.role === 'Loan Officer' && "You have authority to initiate loans, verify customer documentation, and manage lead conversions."}
                        {w.role === 'Collections Officer' && "Your focus is on payment recuperation, PTP (Promise to Pay) management, and delinquency reduction."}
                        {w.role === 'Finance' && "Access granted for treasury operations, bank statement reconciliations, and disbursement approvals."}
                        {w.role === 'Asset Recovery' && "Authorized for litigation filings, asset attachment procedures, and final enforcement actions."}
                        {w.role.includes('Viewer') && "Restricted to read-only access for auditing, reporting, and compliance verification."}
                     </div>
                     <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Badge sm v="secondary">Level 1 Access</Badge>
                        <Badge sm v="secondary">Regional Scope</Badge>
                        {w.mfa && <Badge sm v="ok">AAL2 Verified</Badge>}
                     </div>
                  </div>
               </Card>
            </div>
        </div>
      )}

      {activeTab === 'security' && (
        <Card>
           <CH title="Access Control & MFA" icon={Shield} />
           <div style={{ padding: '0 12px 12px' }}>
              <div style={{ 
                 background: T.surface, padding: 16, borderRadius: 12, border: `1px solid ${T.border}`, 
                 display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                 justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
                 gap: isMobile ? 16 : 0
               }}>
                 <div>
                    <div style={{ fontWeight: 800, color: T.txt, display: 'flex', alignItems: 'center', gap: 8 }}>
                       Multi-Factor Authentication {worker.mfa ? <ShieldCheck size={16} color={T.ok}/> : <ShieldAlert size={16} color={T.danger}/>}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{worker.mfa ? 'Advanced Protection Active (Level 2)' : 'Account currently at risk (Level 1)'}</div>
                 </div>
                 <Btn sm v={worker.mfa ? 'secondary' : 'ok'} onClick={() => {
                   const next = !worker.mfa;
                   // Re-using setWorkers to update the worker object locally
                   setWorkers(ws => ws.map(x => x.id === worker.id ? {...x, mfa: next} : x));
                   
                   // Persist to Supabase
                   import('@/config/supabaseClient').then(({supabase, DEMO_MODE}) => {
                     if(!DEMO_MODE && supabase) {
                       supabase.from('workers').update({ mfa: next }).eq('id', worker.id)
                         .then(({error}) => {
                           if(error) showToast('Sync failed: ' + error.message, 'danger');
                         });
                     }
                   });

                   addAudit('Security Policy Updated', worker.id, `MFA ${next ? 'Enabled' : 'Disabled'}`);
                   showToast(`MFA ${next ? 'enabled' : 'disabled'} successfully`, 'ok');
                   try{SFX.notify();}catch(e){}
                 }}>{worker.mfa ? 'Deactivate' : 'Enroll Now'}</Btn>
              </div>
           </div>
        </Card>
      )}

      {activeTab === 'docs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
             <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: T.txt }}>Worker Documents</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Secure cloud storage for your identity and compliance files</div>
             </div>
             <div>
                <Btn icon={Plus} sm v="primary" onClick={() => fileInputRef.current?.click()}>Upload New</Btn>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept="image/*,.pdf" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if(!file) return;
                  
                  showToast('Preparing file for upload...', 'info');
                  const compressed = await compressImage(file);
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const doc = {
                      id: uid('DOC'),
                      name: file.name,
                      type: file.type,
                      size: file.size,
                      dataUrl: ev.target.result,
                      uploaded: now()
                    };
                    setWorkers(ws => ws.map(x => {
                      if(x.id !== worker.id) return x;
                      const docs = [...(x.docs || []), doc];
                      
                      // Persist to Supabase
                      import('@/config/supabaseClient').then(({supabase, DEMO_MODE}) => {
                        if(!DEMO_MODE && supabase) {
                          supabase.from('workers').update({ docs }).eq('id', worker.id)
                            .then(({error}) => {
                              if(error) {
                                if(error.message.includes('column "docs" does not exist')) {
                                  console.warn("Docs column missing. This is a demo-only update.");
                                } else {
                                  showToast('Sync failed: ' + error.message, 'danger');
                                }
                              }
                            });
                        }
                      });

                      return {...x, docs};
                    }));
                    addAudit('Document Uploaded', worker.id, file.name);
                    showToast(`${file.name} uploaded successfully`, 'ok');
                    try{SFX.save();}catch(e){}
                    // Reset input so the same file can be uploaded again
                    e.target.value = '';
                  };
                  reader.readAsDataURL(compressed);
                }}/>
             </div>
          </div>

          {!worker.docs || worker.docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, background: T.surface, borderRadius: 20, border: `2px dashed ${T.border}` }}>
               <Folder size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
               <div style={{ color: T.muted, fontSize: 14 }}>Your document folder is empty.</div>
               <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>Upload your ID, KRA Pin, or Contract to get started.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
               {worker.docs.map(doc => (
                 <Card key={doc.id} style={{ padding: 0, overflow: 'hidden', transition: '0.2s', border: `1px solid ${T.border}` }} className="sfx-card">
                    <div style={{ height: 120, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                       {doc.type.startsWith('image/') ? (
                         <img src={doc.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                       ) : (
                         <FileText size={40} style={{ opacity: 0.2 }} />
                       )}
                       <div style={{ position: 'absolute', top: 8, right: 8 }}>
                          <button onClick={() => {
                            if(confirm('Delete this document?')) {
                              const newDocs = worker.docs.filter(d => d.id !== doc.id);
                              setWorkers(ws => ws.map(x => x.id === worker.id ? {...x, docs: newDocs} : x));
                              
                              // Persist to Supabase
                              import('@/config/supabaseClient').then(({supabase, DEMO_MODE}) => {
                                if(!DEMO_MODE && supabase) {
                                  supabase.from('workers').update({ docs: newDocs }).eq('id', worker.id)
                                    .then(({error}) => {
                                      if(error) console.error('Delete sync failed', error);
                                    });
                                }
                              });

                              showToast('Document removed', 'info');
                            }
                          }} style={{ background: '#00000080', border: 'none', color: '#fff', padding: 6, borderRadius: 8, cursor: 'pointer' }}>
                             <Trash2 size={14} />
                          </button>
                       </div>
                    </div>
                    <div style={{ padding: 12 }}>
                       <div style={{ fontWeight: 700, fontSize: 13, color: T.txt, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                       <div style={{ fontSize: 10, color: T.muted, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{(doc.size / 1024).toFixed(1)} KB</span>
                          <span>{doc.uploaded}</span>
                       </div>
                       <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                          <Btn sm full v="secondary" icon={Eye} onClick={() => setViewingDoc(doc)}>View</Btn>
                       </div>
                    </div>
                 </Card>
               ))}
            </div>
          )}
        </div>
      )}

      {viewingDoc && <DocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  );
}
