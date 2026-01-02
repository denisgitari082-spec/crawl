"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "../src/lib/supabaseClient";

type Message = { 
  id: string; 
  sender_id?: string; 
  receiver_id?: string; 
  group_id?: string; 
  text: string; 
  created_at: string; 
  is_read: boolean; 
};

type ChatUser = { id: string; email: string; full_name: string; category: string };
type Group = { id: string; name: string; description: string };

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<"chats" | "discover">("chats");
  const [searchQuery, setSearchQuery] = useState(""); // Search state
  const [suggestedUsers, setSuggestedUsers] = useState<ChatUser[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<Group[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<ChatUser | Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Search Logic ---
  const filteredUsers = useMemo(() => {
    return suggestedUsers.filter(u => 
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [suggestedUsers, searchQuery]);

  const filteredGroups = useMemo(() => {
    return suggestedGroups.filter(g => 
      g.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [suggestedGroups, searchQuery]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // 1. Initialization
  useEffect(() => {
    const initApp = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      
      setCurrentUser(user);

      // Sync profile
      const myName = user.user_metadata?.full_name || user.email?.split('@')[0] || "User";
      await supabase.from("profiles").upsert({ 
        id: user.id, 
        email: user.email,
        full_name: myName,
        category: 'Professional'
      });

      // Fetch others
      const { data: users } = await supabase.from("profiles").select("*").neq("id", user.id);
      const { data: groups } = await supabase.from("groups").select("*");
      
      setSuggestedUsers(users || []);
      setSuggestedGroups(groups || []);
      setLoading(false);
    };
    initApp();
  }, []);

  // 2. Chat Realtime Logic
  useEffect(() => {
    if (!selectedTarget || !currentUser?.id) return;

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

    const channel = supabase.channel(`chat-${selectedTarget.id}`, {
      config: { presence: { key: currentUser.id } }
    });

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Message;
        const isMatch = m.group_id === selectedTarget.id || 
                       (m.sender_id === selectedTarget.id && m.receiver_id === currentUser.id) || 
                       (m.sender_id === currentUser.id && m.receiver_id === selectedTarget.id);
        if (isMatch) setMessages(prev => [...prev, m]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTarget, currentUser?.id]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTarget) return;

    const isGroup = !("email" in selectedTarget);
    await supabase.from("messages").insert([{
      text: newMessage,
      sender_id: currentUser.id,
      receiver_id: isGroup ? null : selectedTarget.id,
      group_id: isGroup ? selectedTarget.id : null,
    }]);

    setNewMessage("");
  };

  if (loading) return <div className="loading">Connecting to Secure Chat...</div>;

  return (
    <div className="container">
      <div className="sidebar">
        <div className="tabs">
          <button className={view === "chats" ? "active" : ""} onClick={() => setView("chats")}>Inbox</button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>Explore</button>
        </div>

        {/* SEARCH BAR */}
        <div className="search-area">
          <input 
            type="text" 
            placeholder={`Search ${view === "chats" ? "users" : "groups"}...`} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="list-content">
          <p className="section-title">{view === "chats" ? "ACTIVE PROS" : "COMMUNITIES"}</p>
          
          {view === "chats" ? (
            filteredUsers.length > 0 ? (
              filteredUsers.map(u => (
                <div key={u.id} className={`row ${selectedTarget?.id === u.id ? 'active' : ''}`} onClick={() => setSelectedTarget(u)}>
                  <div className="avatar">{u.full_name?.[0] || u.email?.[0] || "?"}</div>
                  <div className="details">
                    <div className="name">{u.full_name || "User"}</div>
                    <div className="meta">{u.category}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-notice">
                {searchQuery ? "No matches found" : "No other users online"}
              </div>
            )
          ) : (
            <div className="explore">
              <button className="create-btn" onClick={() => setShowCreateGroup(true)}>+ New Community</button>
              {filteredGroups.map(g => (
                <div key={g.id} className={`row ${selectedTarget?.id === g.id ? 'active' : ''}`} onClick={() => setSelectedTarget(g)}>
                   <div className="avatar group">#</div>
                   <div className="name">{g.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chat-window">
        {selectedTarget ? (
          <>
            <div className="header">
              {"email" in selectedTarget ? selectedTarget.full_name : selectedTarget.name}
            </div>
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`bubble-wrapper ${m.sender_id === currentUser.id ? 'sent-wrapper' : 'received-wrapper'}`}>
                  <div className={`bubble ${m.sender_id === currentUser.id ? 'sent' : 'received'}`}>
                    <div className="text">{m.text}</div>
                    <div className="footer">
                      <span className="time">{formatTime(m.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form className="input-box" onSubmit={sendMessage}>
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." />
              <button type="submit">SEND</button>
            </form>
          </>
        ) : <div className="empty">Select a conversation</div>}
      </div>

      {showCreateGroup && (
        <div className="modal-bg">
          <form className="modal" onSubmit={async (e) => {
            e.preventDefault();
            const { data, error } = await supabase.from("groups").insert([{ name: groupName, description: groupDesc, created_by: currentUser.id }]).select().single();
            if (!error) { setSuggestedGroups([data, ...suggestedGroups]); setShowCreateGroup(false); }
          }}>
            <h3>New Community</h3>
            <input placeholder="Name" value={groupName} onChange={e => setGroupName(e.target.value)} required />
            <textarea placeholder="Description" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} />
            <div className="modal-btns">
              <button type="button" onClick={() => setShowCreateGroup(false)}>Cancel</button>
              <button type="submit" className="confirm-btn">Create</button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        .container { display: flex; height: 100vh; background: #0f172a; color: white; font-family: 'Inter', sans-serif; }
        .sidebar { width: 320px; border-right: 1px solid #1e293b; background: #020617; display: flex; flex-direction: column; }
        .tabs { display: flex; border-bottom: 1px solid #1e293b; }
        .tabs button { flex: 1; padding: 18px; background: none; border: none; color: #64748b; cursor: pointer; font-weight: bold; }
        .tabs button.active { color: #3b82f6; border-bottom: 2px solid #3b82f6; background: #0f172a; }
        
        .search-area { padding: 15px; border-bottom: 1px solid #1e293b; }
        .search-area input { width: 100%; padding: 10px 15px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; color: white; outline: none; }
        
        .list-content { flex: 1; overflow-y: auto; padding: 15px; }
        .section-title { font-size: 11px; color: #475569; margin: 10px 0 15px; font-weight: bold; }
        .empty-notice { padding: 40px 10px; text-align: center; color: #475569; font-size: 13px; }
        
        .row { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; cursor: pointer; margin-bottom: 4px; }
        .row:hover { background: #1e293b; }
        .row.active { background: #2563eb; }
        .avatar { width: 40px; height: 40px; background: #334155; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; text-transform: uppercase; }
        .avatar.group { background: #10b981; }
        
        .chat-window { flex: 1; display: flex; flex-direction: column; }
        .header { padding: 20px; border-bottom: 1px solid #1e293b; font-weight: bold; background: #020617; }
        .messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .bubble-wrapper { display: flex; width: 100%; }
        .sent-wrapper { justify-content: flex-end; }
        .received-wrapper { justify-content: flex-start; }
        .bubble { max-width: 65%; padding: 10px 16px; border-radius: 18px; }
        .sent { background: #2563eb; }
        .received { background: #1e293b; border: 1px solid #334155; }
        .footer { font-size: 10px; opacity: 0.6; margin-top: 4px; text-align: right; }
        
        .input-box { padding: 20px; display: flex; gap: 12px; background: #020617; border-top: 1px solid #1e293b; }
        .input-box input { flex: 1; padding: 14px 20px; background: #1e293b; border: none; color: white; border-radius: 25px; outline: none; }
        .input-box button { background: #3b82f6; border: none; color: white; padding: 0 25px; border-radius: 25px; cursor: pointer; font-weight: bold; }
        
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1e293b; padding: 30px; border-radius: 16px; width: 350px; display: flex; flex-direction: column; gap: 15px; }
        .modal input, .modal textarea { padding: 12px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 8px; }
        .confirm-btn { background: #3b82f6; border: none; padding: 12px; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .loading, .empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #64748b; }
      `}</style>
    </div>
  );
}
