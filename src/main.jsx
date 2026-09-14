import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home, Library, Search, Plus, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat2, Volume2, Heart, MoreHorizontal, ListMusic, Upload, LogIn, UserPlus, X, Check, Trash2 } from 'lucide-react';
import './styles.css';

const DEMO_TRACKS = [
  { id:'d1', title:'Velvet Horizon', artist:'Lumin Sessions', album:'Night Drive', genre:'Electronic', artwork:'linear-gradient(135deg,#0f172a,#7c3aed)', duration:216 },
  { id:'d2', title:'Glass Gardens', artist:'The North Arcade', album:'Bloom', genre:'Indie', artwork:'linear-gradient(135deg,#164e63,#14b8a6)', duration:193 },
  { id:'d3', title:'Afterglow', artist:'Maya Vale', album:'Late Hours', genre:'R&B', artwork:'linear-gradient(135deg,#701a75,#fb7185)', duration:242 },
  { id:'d4', title:'Parallel Lines', artist:'House Meridian', album:'City Lights', genre:'House', artwork:'linear-gradient(135deg,#312e81,#38bdf8)', duration:201 },
  { id:'d5', title:'Open Window', artist:'Cedar & Gold', album:'Homecoming', genre:'Acoustic', artwork:'linear-gradient(135deg,#78350f,#f59e0b)', duration:178 },
  { id:'d6', title:'Soft Focus', artist:'Ari Bloom', album:'Soft Focus', genre:'Chill', artwork:'linear-gradient(135deg,#064e3b,#a3e635)', duration:229 },
  { id:'d7', title:'Satellite', artist:'Polar Youth', album:'Signal', genre:'Alternative', artwork:'linear-gradient(135deg,#1e3a8a,#a78bfa)', duration:205 },
  { id:'d8', title:'Midnight Bloom', artist:'Dusk Avenue', album:'The Quiet Club', genre:'Pop', artwork:'linear-gradient(135deg,#4c0519,#f43f5e)', duration:188 }
];

const formatTime = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

async function api(path, options={}) {
  const token = localStorage.getItem('lumin_token');
  const headers = { ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

function Cover({ track, size='md', playState=false, onClick }) {
  return <div className={`cover cover-${size}`} style={{background: track.artwork}} onClick={onClick} role={onClick?'button':undefined} aria-label={onClick?'Play '+track.title:undefined}>
    <span className="cover-mark">{track.title.slice(0,1)}</span>
    {playState && <span className="cover-playing"><Pause size={size==='sm'?15:18} fill="currentColor"/></span>}
  </div>
}

function AuthModal({ mode, setMode, onClose, onAuth }) {
  const [form,setForm] = useState({name:'',email:'',password:''}); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  async function submit(e){ e.preventDefault(); setLoading(true); setError(''); try { const data = await api(mode==='signup'?'/api/register':'/api/login',{method:'POST',body:JSON.stringify(form)}); localStorage.setItem('lumin_token',data.token); onAuth(data.user); onClose(); } catch(err){setError(err.message)} finally{setLoading(false)} }
  return <div className="modal-backdrop" onClick={onClose}><div className="auth-card" onClick={e=>e.stopPropagation()}>
    <button className="icon-btn modal-close" onClick={onClose}><X/></button>
    <div className="brand brand-large"><span className="brand-orb">L</span><span>Lumin</span></div>
    <h2>{mode==='signup'?'Create your library':'Welcome back'}</h2><p className="muted">{mode==='signup'?'A calm home for the music you own.':'Pick up where you left off.'}</p>
    <form onSubmit={submit}>
      {mode==='signup' && <input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>}
      <input type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/>
      <input type="password" minLength="6" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/>
      {error && <div className="error">{error}</div>}
      <button className="primary-btn wide" disabled={loading}>{loading?'Working…':mode==='signup'?'Create account':'Sign in'}</button>
    </form>
    <button className="text-btn" onClick={()=>setMode(mode==='signup'?'login':'signup')}>{mode==='signup'?'Already have an account? Sign in':'New to Lumin? Create an account'}</button>
  </div></div>
}

function App(){
  const [tab,setTab]=useState('home'); const [query,setQuery]=useState(''); const [tracks,setTracks]=useState([]); const [playlists,setPlaylists]=useState([]); const [user,setUser]=useState(null); const [authMode,setAuthMode]=useState(null);
  const [current,setCurrent]=useState(null); const [playing,setPlaying]=useState(false); const [progress,setProgress]=useState(0); const [volume,setVolume]=useState(.8); const [isShuffle,setShuffle]=useState(false); const [isRepeat,setRepeat]=useState(false); const [toast,setToast]=useState('');
  const audioRef=useRef(new Audio()); const audio=audioRef.current;
  const demoCtx=useRef(null); const demoTimer=useRef(null);

  useEffect(()=>{ api('/api/tracks').then(d=>setTracks(d.tracks)).catch(()=>{}); const token=localStorage.getItem('lumin_token'); if(token) api('/api/me').then(d=>{setUser(d.user); return api('/api/playlists')}).then(d=>setPlaylists(d.playlists)).catch(()=>localStorage.removeItem('lumin_token')); return ()=>audio.pause(); },[]);
  useEffect(()=>{ audio.volume=volume; },[volume]);
  useEffect(()=>{ if(!toast)return; const t=setTimeout(()=>setToast(''),2200); return()=>clearTimeout(t)},[toast]);

  const allTracks = useMemo(()=>[...tracks,...DEMO_TRACKS],[tracks]);
  const filtered = useMemo(()=>allTracks.filter(t=>`${t.title} ${t.artist} ${t.album} ${t.genre}`.toLowerCase().includes(query.toLowerCase())),[allTracks,query]);
  const currentIndex = current ? allTracks.findIndex(t=>t.id===current.id) : -1;

  function stopDemo(){ if(demoTimer.current) clearInterval(demoTimer.current); demoTimer.current=null; try{demoCtx.current?.close()}catch{} demoCtx.current=null; }
  function playDemo(track){ stopDemo(); const C=window.AudioContext||window.webkitAudioContext; if(!C){return;} const ctx=new C(); demoCtx.current=ctx; let start=0; const notes=[220,277.18,329.63,440]; const tick=()=>{ const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.type='sine'; osc.frequency.value=notes[start%notes.length]*(1+(track.id.charCodeAt(1)||1)%3*.01); gain.gain.setValueAtTime(0,ctx.currentTime); gain.gain.linearRampToValueAtTime(.055,ctx.currentTime+.02); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+1.4); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+1.45); start++;}; tick(); demoTimer.current=setInterval(tick,700); }
  function selectTrack(track){ setCurrent(track); setProgress(0); setPlaying(true); if(track.streamUrl){ audio.src=track.streamUrl; audio.play().catch(()=>{}); } else playDemo(track); }
  function togglePlay(){ if(!current) return selectTrack(allTracks[0]); if(playing){setPlaying(false); audio.pause(); if(!current.streamUrl) stopDemo();} else {setPlaying(true); if(current.streamUrl) audio.play().catch(()=>{}); else playDemo(current);} }
  function skip(dir){ if(!allTracks.length)return; const idx=currentIndex<0?0:(isShuffle?Math.floor(Math.random()*allTracks.length):(currentIndex+dir+allTracks.length)%allTracks.length); selectTrack(allTracks[idx]); }
  function seek(v){setProgress(Number(v)); if(current?.streamUrl && audio.duration) audio.currentTime=Number(v)*audio.duration;}
  useEffect(()=>{ audio.ontimeupdate=()=>{if(audio.duration)setProgress(audio.currentTime/audio.duration)}; audio.onended=()=>{ if(isRepeat) selectTrack(current); else skip(1) }; return()=>{audio.ontimeupdate=null;audio.onended=null} },[current,isRepeat,isShuffle,allTracks]);

  async function createPlaylist(){ if(!user){setAuthMode('login');return;} const name=window.prompt('Playlist name','My Playlist'); if(!name)return; try{const d=await api('/api/playlists',{method:'POST',body:JSON.stringify({name})});setPlaylists(p=>[d.playlist,...p]);setToast('Playlist created');setTab('library')}catch(e){setToast(e.message)} }
  async function addToPlaylist(playlistId,trackId){ try{await api(`/api/playlists/${playlistId}/tracks`,{method:'POST',body:JSON.stringify({trackId})}); const d=await api('/api/playlists');setPlaylists(d.playlists);setToast('Added to playlist')}catch(e){setToast(e.message)} }
  async function upload(e){const file=e.target.files?.[0]; if(!file)return; if(!user){setAuthMode('login');return;} const fd=new FormData();fd.append('audio',file);fd.append('title',file.name.replace(/\.[^.]+$/,'')); try{const d=await api('/api/tracks',{method:'POST',body:fd});setTracks(t=>[d.track,...t]);setToast('Uploaded to your library')}catch(err){setToast(err.message)}}

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-orb">L</span><span>Lumin</span></div>
      <nav>
        <button className={tab==='home'?'active':''} onClick={()=>setTab('home')}><Home/>Home</button>
        <button className={tab==='search'?'active':''} onClick={()=>setTab('search')}><Search/>Search</button>
        <button className={tab==='library'?'active':''} onClick={()=>setTab('library')}><Library/>Library</button>
      </nav>
      <div className="sidebar-divider"/>
      <div className="sidebar-section-title">Playlists <button className="icon-btn" onClick={createPlaylist}><Plus size={17}/></button></div>
      <div className="playlist-nav">{playlists.length?playlists.map(p=><button key={p.id} onClick={()=>setTab(`playlist:${p.id}`)}><ListMusic size={16}/>{p.name}</button>):<span className="muted small">Create a playlist to see it here.</span>}</div>
      <div className="sidebar-bottom">{user ? <div className="profile-row"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-btn" onClick={()=>{localStorage.removeItem('lumin_token');setUser(null);setPlaylists([])}}><LogIn size={17}/></button></div> : <button className="outline-btn wide" onClick={()=>setAuthMode('login')}><LogIn size={17}/>Sign in</button>}</div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand brand"><span className="brand-orb">L</span><span>Lumin</span></div>
        <div className="searchbar"><Search size={18}/><input value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value)setTab('search')}} placeholder="Search artists, songs, albums…"/><kbd>⌘ K</kbd></div>
        {!user && <button className="login-pill" onClick={()=>setAuthMode('login')}><UserPlus size={16}/> Account</button>}
      </header>
      <div className="page-scroll">
        {tab==='home' && <HomeView tracks={allTracks} current={current} playing={playing} onPlay={selectTrack} onNewRelease={()=>setToast('Explore is powered by your own library in this demo')}/>} 
        {tab==='search' && <SearchView tracks={filtered} query={query} current={current} playing={playing} onPlay={selectTrack} playlists={playlists} onAdd={addToPlaylist}/>} 
        {tab==='library' && <LibraryView tracks={tracks} playlists={playlists} current={current} playing={playing} onPlay={selectTrack} onCreate={createPlaylist} onUpload={upload}/>} 
        {tab.startsWith('playlist:') && <PlaylistView playlist={playlists.find(p=>p.id===tab.split(':')[1])} current={current} playing={playing} onPlay={selectTrack} onRemove={async id=>{try{await api(`/api/playlists/${tab.split(':')[1]}/tracks/${id}`,{method:'DELETE'});const d=await api('/api/playlists');setPlaylists(d.playlists)}catch{}}}/>} 
      </div>
    </main>

    <div className="player-wrap"><div className="player">
      <div className="now-playing">{current?<><Cover track={current} size="sm" playState={playing}/><div className="np-copy"><strong>{current.title}</strong><span>{current.artist}</span></div><button className="icon-btn favorite"><Heart size={18}/></button></>:<div className="empty-now"><div className="empty-dot"/><span>Choose something to play</span></div>}</div>
      <div className="player-center"><div className="transport"><button className={`icon-btn ${isShuffle?'selected':''}`} onClick={()=>setShuffle(!isShuffle)}><Shuffle size={17}/></button><button className="icon-btn" onClick={()=>skip(-1)}><SkipBack size={19} fill="currentColor"/></button><button className="play-button" onClick={togglePlay}>{playing?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}</button><button className="icon-btn" onClick={()=>skip(1)}><SkipForward size={19} fill="currentColor"/></button><button className={`icon-btn ${isRepeat?'selected':''}`} onClick={()=>setRepeat(!isRepeat)}><Repeat2 size={17}/></button></div><div className="progress-row"><span>{current?formatTime((current.duration||180)*progress):'0:00'}</span><input type="range" min="0" max="1" step="0.001" value={progress} onChange={e=>seek(e.target.value)}/><span>{current?formatTime(current.duration||180):'0:00'}</span></div></div>
      <div className="player-actions"><Volume2 size={17}/><input className="volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></div>
    </div></div>
    {authMode && <AuthModal mode={authMode} setMode={setAuthMode} onClose={()=>setAuthMode(null)} onAuth={u=>setUser(u)}/>} {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function Hero({track,onPlay,playing}){return <section className="hero"><div className="hero-art" style={{background:track.artwork}}><span>{track.title[0]}</span></div><div className="hero-copy"><span className="eyebrow">FEATURED IN YOUR LIBRARY</span><h1>{track.title}</h1><p>{track.artist} · {track.album}</p><button className="primary-btn" onClick={()=>onPlay(track)}>{playing?<Pause size={18}/>:<Play size={18} fill="currentColor"/>}{playing?'Pause':'Play now'}</button></div></section>}
function Section({title,children,action}){return <section className="section"><div className="section-heading"><h2>{title}</h2>{action}</div>{children}</section>}
function Row({track,onPlay,playing,onAdd,playlists}){const [open,setOpen]=useState(false);return <div className="track-row" onDoubleClick={()=>onPlay(track)}><div className="row-cover"><Cover track={track} size="sm" playState={playing}/></div><div className="row-main"><strong>{track.title}</strong><span>{track.artist}</span></div><span className="row-album">{track.album}</span><span className="row-genre">{track.genre}</span><div className="row-actions"><span>{track.duration?formatTime(track.duration):'—'}</span>{onAdd&&<div className="menu-wrap"><button className="icon-btn" onClick={()=>setOpen(!open)}><MoreHorizontal size={18}/></button>{open&&<div className="mini-menu">{playlists?.map(p=><button key={p.id} onClick={()=>{onAdd(p.id,track.id);setOpen(false)}}><ListMusic size={14}/>{p.name}</button>)}</div>}</div>}</div><button className="row-play" onClick={()=>onPlay(track)}>{playing?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}</button></div>}
function TrackGrid({tracks,onPlay,current,playing}){return <div className="track-grid">{tracks.map(t=><article className="track-card" key={t.id}><div className="card-art-wrap"><Cover track={t} size="lg" onClick={()=>onPlay(t)} playState={current?.id===t.id&&playing}/><button className="floating-play" onClick={()=>onPlay(t)}>{current?.id===t.id&&playing?<Pause size={17} fill="currentColor"/>:<Play size={17} fill="currentColor"/>}</button></div><strong>{t.title}</strong><span>{t.artist}</span><small>{t.album}</small></article>)}</div>}
function HomeView({tracks,current,playing,onPlay,onNewRelease}){return <div className="page"><div className="page-intro"><div><span className="eyebrow">SUNDAY, SEPTEMBER 13</span><h1>Made for your moments.</h1><p>Listen to your library, curate a little magic, and keep the distractions out.</p></div><button className="soft-btn" onClick={onNewRelease}>What's new <span>↗</span></button></div><Hero track={tracks[0]} onPlay={onPlay} playing={current?.id===tracks[0]?.id&&playing}/><Section title="Recently played"><TrackGrid tracks={tracks.slice(0,6)} current={current} playing={playing} onPlay={onPlay}/></Section><Section title="Good morning"><div className="rows">{tracks.slice(2,7).map(t=><Row key={t.id} track={t} onPlay={onPlay} playing={current?.id===t.id&&playing}/>)}</div></Section></div>}
function SearchView({tracks,query,current,playing,onPlay,playlists,onAdd}){return <div className="page"><div className="page-intro compact"><div><span className="eyebrow">SEARCH</span><h1>{query?`Results for “${query}”`:'Find your next favorite.'}</h1></div></div>{tracks.length?<><Section title="Songs"><div className="rows">{tracks.map(t=><Row key={t.id} track={t} onPlay={onPlay} playing={current?.id===t.id&&playing} playlists={playlists} onAdd={onAdd}/>)}</div></Section></>:<div className="empty-state"><Search size={34}/><h3>No results yet</h3><p>Try a different artist, song, album, or genre.</p></div>}</div>}
function LibraryView({tracks,playlists,current,playing,onPlay,onCreate,onUpload}){return <div className="page"><div className="page-intro"><div><span className="eyebrow">YOUR LIBRARY</span><h1>All the music you keep.</h1><p>Your uploaded tracks stay in your private local collection.</p></div><div className="intro-actions"><label className="soft-btn"><Upload size={16}/> Add audio<input type="file" accept="audio/*" onChange={onUpload} hidden/></label><button className="primary-btn" onClick={onCreate}><Plus size={17}/> New playlist</button></div></div><Section title="Songs"><div className="rows">{tracks.length?tracks.map(t=><Row key={t.id} track={t} onPlay={onPlay} playing={current?.id===t.id&&playing}/>):<div className="empty-state"><Upload size={34}/><h3>Your library is waiting.</h3><p>Upload an audio file to start building it.</p></div>}</div></Section><Section title="Playlists"><div className="playlist-grid">{playlists.map(p=><div className="playlist-card" key={p.id}><div className="playlist-mosaic">{(p.tracks||[]).slice(0,4).map((t,i)=><span key={i} style={{background:t.artwork}}>{t?.title?.[0]}</span>)}</div><strong>{p.name}</strong><small>{p.tracks?.length||0} songs</small></div>)}{!playlists.length&&<div className="playlist-empty" onClick={onCreate}><Plus/><span>Create your first playlist</span></div>}</div></Section></div>}
function PlaylistView({playlist,current,playing,onPlay,onRemove}){if(!playlist)return <div className="page"><div className="empty-state"><ListMusic/><h3>Playlist not found</h3></div></div>; return <div className="page"><div className="playlist-hero"><div className="playlist-large-art">{playlist.name.slice(0,1)}</div><div><span className="eyebrow">PLAYLIST</span><h1>{playlist.name}</h1><p>{playlist.tracks?.length||0} songs · Private</p><button className="primary-btn" onClick={()=>playlist.tracks?.[0]&&onPlay(playlist.tracks[0])}><Play size={18} fill="currentColor"/> Play playlist</button></div></div><Section title="Tracks"><div className="rows">{playlist.tracks?.length?playlist.tracks.map(t=><Row key={t.id} track={t} onPlay={onPlay} playing={current?.id===t.id&&playing}/>):<div className="empty-state"><ListMusic size={34}/><h3>This playlist is empty.</h3><p>Add songs from Search with the menu.</p></div>}</div></Section></div>}

createRoot(document.getElementById('root')).render(<App/>);
