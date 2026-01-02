"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../src/lib/supabaseClient";

type Message = { id: string; sender_id?: string; receiver_id?: string; group_id?: string; text: string; created_at: string; };
type ChatUser = { id: string; email: string };
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

  // Group Creation State
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. DATA INITIALIZATION
  useEffect(() => {
    const initApp = async () => {
      try {
        setLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          alert("Auth Error: Please log in again.");
          setLoading(false);
          return;
        }
        setCurrentUser(user);

        // SYNC PROFILE: Ensure you exist so others see you
        const { error: upsertError } = await supabase.from("profiles").upsert({ id: user.id, email: user.email });
        if (upsertError) console.error("Profile Sync Error:", upsertError.message);

        // FETCH ALL USERS (Except yourself)
        const { data: users, error: uErr } = await supabase.from("profiles").select("id, email").neq("id", user.id);
        if (uErr) alert("User Fetch Error: " + uErr.message);
        else setSuggestedUsers(users || []);

        // FETCH ALL GROUPS
        const { data: groups, error: gErr } = await supabase.from("groups").select("*");
        if (gErr) alert("Group Fetch Error: " + gErr.message);
        else setSuggestedGroups(groups || []);

      } catch (err) {
        console.error("Critical Init Error:", err);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // 2. FETCH MESSAGES & REALTIME
  useEffect(() => {
    if (!selectedTarget || !currentUser) return;

    const fetchMessages = async () => {
      let query = supabase.from("messages").select("*").order("created_at", { ascending: true });
      
      if ("email" in selectedTarget) {
        query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedTarget.id}),and(sender_id.eq.${selectedTarget.id},receiver_id.eq.${currentUser.id})`);
      } else {
        query = query.eq("group_id", selectedTarget.id);
      }

      const { data, error } = await query;
      if (error) console.error("Message Fetch Error:", error.message);
      setMessages(data || []);
    };

    fetchMessages();

    const channel = supabase.channel(`room-${selectedTarget.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as Message;
        // Only add if it belongs to this specific chat
        setMessages(prev => [...prev, newMsg]);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTarget, currentUser]);

  // 3. ACTIONS (Create & Send)
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !currentUser) return;

    const { data, error } = await supabase.from("groups")
      .insert([{ name: groupName, description: groupDesc, created_by: currentUser.id }])
      .select().single();

    if (error) {
      alert("Database Create Error: " + error.message);
    } else {
      setSuggestedGroups(prev => [data, ...prev]);
      setShowCreateGroup(false);
      setGroupName("");
      setSelectedTarget(data); // Open the new group chat
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTarget || !currentUser) return;

    const isGroup = !("email" in selectedTarget);
    const { error } = await supabase.from("messages").insert([{
      text: newMessage,
      sender_id: currentUser.id,
      receiver_id: isGroup ? null : selectedTarget.id,
      group_id: isGroup ? selectedTarget.id : null
    }]);

    if (error) {
      alert("Send Error: " + error.message);
    } else {
      setNewMessage("");
    }
  };

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (loading) return <div className="loading-screen">Connecting to Pro-Network...</div>;

  return (
    <div className="messenger-container">
      <div className="sidebar">
        <div className="tabs">
          <button className={view === "chats" ? "active" : ""} onClick={() => setView("chats")}>Inbox</button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>Explore</button>
        </div>

        <div className="sidebar-content">
          {view === "chats" ? (
            <div className="section">
              <h4>Suggested Users</h4>
              {suggestedUsers.length > 0 ? suggestedUsers.map(u => (
                <div key={u.id} className={`item ${selectedTarget?.id === u.id ? 'active' : ''}`} onClick={() => setSelectedTarget(u)}>
                  <div className="status-dot"></div>
                  {u.email}
                </div>
              )) : <p className="empty-txt">No users found. Ensure 'profiles' table has data.</p>}
            </div>
          ) : (
            <div className="explore-view">
              <button className="create-group-btn" onClick={() => setShowCreateGroup(true)}>+ Create Group</button>
              <h4>Public Groups</h4>
              {suggestedGroups.map(g => (
                <div key={g.id} className={`item ${selectedTarget?.id === g.id ? 'active' : ''}`} onClick={() => setSelectedTarget(g)}>
                  # {g.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chat-window">
        {selectedTarget ? (
          <>
            <div className="chat-header">
                <strong>{"email" in selectedTarget ? selectedTarget.email : `Community: ${selectedTarget.name}`}</strong>
            </div>
            <div className="message-list">
              {messages.map((m, i) => (
                <div key={m.id || i} className={`msg ${m.sender_id === currentUser?.id ? 'sent' : 'received'}`}>{m.text}</div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form className="input-area" onSubmit={sendMessage}>
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message..." autoFocus />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="empty-state">
             <h3>Select a Pro to Chat</h3>
             <p>Use the Inbox or Explore tabs to find people and groups.</p>
          </div>
        )}
      </div>

      {showCreateGroup && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={handleCreateGroup}>
            <h3>Start New Community</h3>
            <input placeholder="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} required />
            <textarea placeholder="Description" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCreateGroup(false)}>Cancel</button>
              <button type="submit" className="confirm">Create</button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        .messenger-container { display: flex; height: 100vh; background: #0f172a; color: white; }
        .sidebar { width: 300px; border-right: 1px solid #1e293b; display: flex; flex-direction: column; background: #0b0f1a; }
        .tabs { display: flex; border-bottom: 1px solid #1e293b; }
        .tabs button { flex: 1; padding: 15px; background: none; border: none; color: #64748b; cursor: pointer; }
        .tabs button.active { color: #3b82f6; border-bottom: 2px solid #3b82f6; background: #161e2e; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 15px; }
        .item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; background: #1e293b; font-size: 13px; }
        .item.active { background: #3b82f6; }
        .status-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
        .create-group-btn { width: 100%; padding: 12px; background: #10b981; border: none; border-radius: 8px; color: white; font-weight: bold; margin-bottom: 20px; cursor: pointer; }
        .chat-window { flex: 1; display: flex; flex-direction: column; }
        .chat-header { padding: 20px; background: #111827; border-bottom: 1px solid #1e293b; }
        .message-list { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .msg { max-width: 75%; padding: 10px 15px; border-radius: 12px; font-size: 14px; }
        .sent { align-self: flex-end; background: #3b82f6; }
        .received { align-self: flex-start; background: #334155; }
        .input-area { padding: 20px; display: flex; gap: 10px; border-top: 1px solid #1e293b; }
        .input-area input { flex: 1; padding: 12px; background: #1e293b; border: none; color: white; border-radius: 8px; outline: none; }
        .input-area button { background: #3b82f6; border: none; color: white; padding: 0 20px; border-radius: 8px; cursor: pointer; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; }
        .modal { background: #1e293b; padding: 25px; border-radius: 12px; width: 350px; display: flex; flex-direction: column; gap: 15px; }
        .modal input, .modal textarea { padding: 10px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 8px; }
        .confirm { background: #3b82f6; border: none; padding: 10px; color: white; border-radius: 8px; cursor: pointer; }
        .loading-screen { height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: white; font-size: 20px; }
        h4 { font-size: 11px; color: #4b5563; text-transform: uppercase; margin-bottom: 10px; }
        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #4b5563; text-align: center; }
      `}</style>
    </div>
  );
}
