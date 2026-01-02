"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../src/lib/supabaseClient";

type Message = { id: string; sender_id?: string; receiver_id?: string; group_id?: string; text: string; created_at: string; };
type ChatUser = { id: string; email: string; full_name: string; category: string };
type Group = { id: string; name: string; description: string };

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<"chats" | "discover">("chats");
  const [suggestedUsers, setSuggestedUsers] = useState<ChatUser[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<Group[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<ChatUser | Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }
        setCurrentUser(user);

        // SYNC PROFILE: Using your correct columns (id, email, full_name, category)
        await supabase.from("profiles").upsert({ 
          id: user.id, 
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          category: 'User' 
        });

        // FETCH USERS: Selecting the correct columns
        const { data: users, error: uErr } = await supabase
          .from("profiles")
          .select("id, email, full_name, category")
          .neq("id", user.id);
        
        if (uErr) alert("User Fetch Error: " + uErr.message);
        else setSuggestedUsers(users || []);

        // FETCH GROUPS
        const { data: groups, error: gErr } = await supabase.from("groups").select("*");
        if (gErr) console.error("Groups Error:", gErr.message);
        else setSuggestedGroups(groups || []);

      } catch (err) {
        console.error("Init Error:", err);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  // Message Fetching & Realtime
  useEffect(() => {
    if (!selectedTarget || !currentUser) return;

    const fetchMessages = async () => {
      let query = supabase.from("messages").select("*").order("created_at", { ascending: true });
      if ("email" in selectedTarget) {
        query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedTarget.id}),and(sender_id.eq.${selectedTarget.id},receiver_id.eq.${currentUser.id})`);
      } else {
        query = query.eq("group_id", selectedTarget.id);
      }
      const { data } = await query;
      setMessages(data || []);
    };

    fetchMessages();

    const channel = supabase.channel(`chat-${selectedTarget.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTarget, currentUser]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const { data, error } = await supabase.from("groups")
      .insert([{ name: groupName, description: groupDesc, created_by: currentUser.id }])
      .select()
      .single();

    if (error) {
      alert("Group Error: " + error.message);
    } else {
      setSuggestedGroups(prev => [data, ...prev]);
      setShowCreateGroup(false);
      setGroupName("");
      setSelectedTarget(data);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTarget) return;

    const isGroup = !("email" in selectedTarget);
    const { error } = await supabase.from("messages").insert([{
      text: newMessage,
      sender_id: currentUser.id,
      receiver_id: isGroup ? null : selectedTarget.id,
      group_id: isGroup ? selectedTarget.id : null
    }]);

    if (!error) setNewMessage("");
    else alert("Send failed: " + error.message);
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading) return <div className="loader">Connecting...</div>;

  return (
    <div className="messenger">
      <div className="sidebar">
        <div className="nav-tabs">
          <button className={view === "chats" ? "active" : ""} onClick={() => setView("chats")}>Inbox</button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>Explore</button>
        </div>

        <div className="scroll-area">
          {view === "chats" ? (
            <>
              <p className="label">SUGGESTED PROS</p>
              {suggestedUsers.map(u => (
                <div key={u.id} className={`user-row ${selectedTarget?.id === u.id ? 'active' : ''}`} onClick={() => setSelectedTarget(u)}>
                  <div className="avatar">{u.full_name?.[0] || u.email[0]}</div>
                  <div className="info">
                    <span className="name">{u.full_name || u.email.split('@')[0]}</span>
                    <span className="cat">{u.category || 'Professional'}</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="explore">
              <button className="create-btn" onClick={() => setShowCreateGroup(true)}>+ Create New Group</button>
              <p className="label">PUBLIC GROUPS</p>
              {suggestedGroups.map(g => (
                <div key={g.id} className={`user-row ${selectedTarget?.id === g.id ? 'active' : ''}`} onClick={() => setSelectedTarget(g)}>
                  <div className="avatar group-av">#</div>
                  <span className="name">{g.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="main-chat">
        {selectedTarget ? (
          <>
            <div className="chat-top">
              {"email" in selectedTarget ? (selectedTarget.full_name || selectedTarget.email) : selectedTarget.name}
            </div>
            <div className="msgs">
              {messages.map((m, i) => (
                <div key={m.id || i} className={`bubble ${m.sender_id === currentUser?.id ? 'me' : 'them'}`}>
                  {m.text}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form className="input-bar" onSubmit={sendMessage}>
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." />
              <button type="submit">SEND</button>
            </form>
          </>
        ) : (
          <div className="welcome">Select a user to start a conversation</div>
        )}
      </div>

      {showCreateGroup && (
        <div className="overlay">
          <form className="modal" onSubmit={handleCreateGroup}>
            <h3>Create Group</h3>
            <input placeholder="Name" value={groupName} onChange={e => setGroupName(e.target.value)} required />
            <textarea placeholder="Description" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} />
            <div className="btns">
              <button type="button" onClick={() => setShowCreateGroup(false)}>Cancel</button>
              <button type="submit" className="prime">Create</button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        .messenger { display: flex; height: 100vh; background: #0f172a; color: white; font-family: sans-serif; }
        .sidebar { width: 300px; border-right: 1px solid #1e293b; display: flex; flex-direction: column; background: #020617; }
        .nav-tabs { display: flex; background: #1e293b; }
        .nav-tabs button { flex: 1; padding: 15px; background: none; border: none; color: #94a3b8; cursor: pointer; }
        .nav-tabs button.active { color: #3b82f6; border-bottom: 2px solid #3b82f6; }
        .scroll-area { flex: 1; overflow-y: auto; padding: 15px; }
        .label { font-size: 10px; color: #475569; margin: 20px 0 10px; letter-spacing: 1px; }
        .user-row { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; cursor: pointer; margin-bottom: 5px; }
        .user-row:hover { background: #1e293b; }
        .user-row.active { background: #3b82f6; }
        .avatar { width: 36px; height: 36px; background: #334155; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .group-av { background: #10b981; }
        .info { display: flex; flex-direction: column; }
        .name { font-size: 14px; font-weight: 500; }
        .cat { font-size: 11px; color: #94a3b8; }
        .create-btn { width: 100%; padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .main-chat { flex: 1; display: flex; flex-direction: column; }
        .chat-top { padding: 20px; border-bottom: 1px solid #1e293b; font-weight: bold; background: #020617; }
        .msgs { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .bubble { max-width: 70%; padding: 10px 15px; border-radius: 15px; font-size: 14px; }
        .me { align-self: flex-end; background: #3b82f6; }
        .them { align-self: flex-start; background: #1e293b; }
        .input-bar { padding: 20px; display: flex; gap: 10px; background: #020617; border-top: 1px solid #1e293b; }
        .input-bar input { flex: 1; padding: 12px; background: #1e293b; border: none; color: white; border-radius: 8px; }
        .input-bar button { background: #3b82f6; border: none; color: white; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal { background: #1e293b; padding: 25px; border-radius: 12px; width: 350px; display: flex; flex-direction: column; gap: 15px; }
        .modal input, .modal textarea { padding: 10px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 6px; }
        .btns { display: flex; justify-content: flex-end; gap: 10px; }
        .prime { background: #3b82f6; border: none; padding: 8px 20px; color: white; border-radius: 6px; cursor: pointer; }
        .welcome { flex: 1; display: flex; align-items: center; justify-content: center; color: #475569; }
        .loader { height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }
      `}</style>
    </div>
  );
}
