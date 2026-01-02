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
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log("No user session found");
          setLoading(false);
          return;
        }
        
        setCurrentUser(user);

        // Sync profile with your specific columns
        await supabase.from("profiles").upsert({ 
          id: user.id, 
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
          category: 'Professional'
        });

        // Fetch other pros
        const { data: users } = await supabase
          .from("profiles")
          .select("id, email, full_name, category")
          .neq("id", user.id);
        
        setSuggestedUsers(users || []);

        // Fetch groups
        const { data: groups } = await supabase.from("groups").select("*");
        setSuggestedGroups(groups || []);

      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  // Fetch messages when a target is selected
  useEffect(() => {
    if (!selectedTarget || !currentUser?.id) return;

    const fetchMessages = async () => {
      let query = supabase.from("messages").select("*").order("created_at", { ascending: true });
      
      if ("email" in selectedTarget) {
        // Person to Person logic
        query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedTarget.id}),and(sender_id.eq.${selectedTarget.id},receiver_id.eq.${currentUser.id})`);
      } else {
        // Group logic
        query = query.eq("group_id", selectedTarget.id);
      }

      const { data } = await query;
      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages for the current target
    const channel = supabase.channel(`room-${selectedTarget.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as Message;
        // Logic to ensure message belongs in current view
        if (newMsg.group_id === selectedTarget.id || 
           (newMsg.sender_id === selectedTarget.id && newMsg.receiver_id === currentUser.id) ||
           (newMsg.sender_id === currentUser.id && newMsg.receiver_id === selectedTarget.id)) {
            setMessages(prev => [...prev, newMsg]);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTarget, currentUser?.id]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !currentUser?.id) return;

    const { data, error } = await supabase.from("groups")
      .insert([{ name: groupName, description: groupDesc, created_by: currentUser.id }])
      .select().single();

    if (error) {
      alert("Error creating group: " + error.message);
    } else {
      setSuggestedGroups(prev => [data, ...prev]);
      setShowCreateGroup(false);
      setGroupName("");
      setSelectedTarget(data);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTarget || !currentUser?.id) return;

    const isGroup = !("email" in selectedTarget);
    const { error } = await supabase.from("messages").insert([{
      text: newMessage,
      sender_id: currentUser.id,
      receiver_id: isGroup ? null : selectedTarget.id,
      group_id: isGroup ? selectedTarget.id : null
    }]);

    if (!error) {
      setNewMessage("");
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // If loading or no user, show a basic message to prevent 'id' of null error
  if (loading) return <div className="loading">Checking Authentication...</div>;
  if (!currentUser) return <div className="loading">Please log in to view messages.</div>;

  return (
    <div className="container">
      <div className="sidebar">
        <div className="tabs">
          <button className={view === "chats" ? "active" : ""} onClick={() => setView("chats")}>Inbox</button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>Explore</button>
        </div>

        <div className="list-content">
          {view === "chats" ? (
            <>
              <p className="section-title">SUGGESTED PROS</p>
              {suggestedUsers.map(u => (
                <div key={u.id} className={`row ${selectedTarget?.id === u.id ? 'active' : ''}`} onClick={() => setSelectedTarget(u)}>
                  <div className="avatar">{u.full_name?.[0] || u.email[0]}</div>
                  <div className="details">
                    <div className="name">{u.full_name || u.email.split('@')[0]}</div>
                    <div className="meta">{u.category}</div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="explore">
              <button className="create-btn" onClick={() => setShowCreateGroup(true)}>+ New Group</button>
              <p className="section-title">PUBLIC GROUPS</p>
              {suggestedGroups.map(g => (
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
              {"email" in selectedTarget ? (selectedTarget.full_name || selectedTarget.email) : selectedTarget.name}
            </div>
            <div className="messages">
              {messages.map((m, i) => (
                <div key={m.id || i} className={`bubble ${m.sender_id === currentUser.id ? 'sent' : 'received'}`}>
                  {m.text}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form className="input-box" onSubmit={sendMessage}>
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." />
              <button type="submit">SEND</button>
            </form>
          </>
        ) : (
          <div className="empty">Select a conversation</div>
        )}
      </div>

      {showCreateGroup && (
        <div className="modal-bg">
          <form className="modal" onSubmit={handleCreateGroup}>
            <h3>Create Pro Group</h3>
            <input placeholder="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} required />
            <textarea placeholder="Description" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} />
            <div className="modal-btns">
              <button type="button" onClick={() => setShowCreateGroup(false)}>Cancel</button>
              <button type="submit" className="confirm-btn">Create</button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        .container { display: flex; height: 100vh; background: #0f172a; color: white; font-family: sans-serif; }
        .sidebar { width: 300px; border-right: 1px solid #1e293b; display: flex; flex-direction: column; background: #020617; }
        .tabs { display: flex; border-bottom: 1px solid #1e293b; }
        .tabs button { flex: 1; padding: 15px; background: none; border: none; color: #64748b; cursor: pointer; }
        .tabs button.active { color: #3b82f6; border-bottom: 2px solid #3b82f6; background: #161e2e; }
        .list-content { flex: 1; overflow-y: auto; padding: 15px; }
        .section-title { font-size: 10px; color: #475569; margin: 20px 0 10px; letter-spacing: 1px; }
        .row { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; cursor: pointer; margin-bottom: 5px; }
        .row:hover { background: #1e293b; }
        .row.active { background: #3b82f6; }
        .avatar { width: 36px; height: 36px; background: #334155; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
        .avatar.group { background: #10b981; }
        .details { overflow: hidden; }
        .name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meta { font-size: 11px; color: #94a3b8; }
        .create-btn { width: 100%; padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 10px; }
        .chat-window { flex: 1; display: flex; flex-direction: column; }
        .header { padding: 20px; border-bottom: 1px solid #1e293b; font-weight: bold; background: #020617; }
        .messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .bubble { max-width: 70%; padding: 10px 15px; border-radius: 15px; font-size: 14px; }
        .sent { align-self: flex-end; background: #3b82f6; }
        .received { align-self: flex-start; background: #1e293b; }
        .input-box { padding: 20px; display: flex; gap: 10px; border-top: 1px solid #1e293b; background: #020617; }
        .input-box input { flex: 1; padding: 12px; background: #1e293b; border: none; color: white; border-radius: 8px; }
        .input-box button { background: #3b82f6; border: none; color: white; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal { background: #1e293b; padding: 25px; border-radius: 12px; width: 350px; display: flex; flex-direction: column; gap: 15px; }
        .modal input, .modal textarea { padding: 10px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 6px; }
        .modal-btns { display: flex; justify-content: flex-end; gap: 10px; }
        .confirm-btn { background: #3b82f6; border: none; padding: 8px 20px; color: white; border-radius: 6px; cursor: pointer; }
        .empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #475569; }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }
      `}</style>
    </div>
  );
}
}
