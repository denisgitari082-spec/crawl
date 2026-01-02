"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../src/lib/supabaseClient";

type Message = { id: string; sender_id?: string; receiver_id?: string; group_id?: string; text: string; created_at: string; };
type ChatUser = { id: string; email: string };
type Group = { id: string; name: string; description: string };

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<"chats" | "discover">("chats");
  const [chats, setChats] = useState<ChatUser[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<ChatUser[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<Group[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<ChatUser | Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  
  // Group Creation State
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        // Ensure user exists in profiles so they appear to others
        await supabase.from("profiles").upsert({ id: user.id, email: user.email });
        fetchSidebarData(user.id);
      }
    };
    setup();
  }, [view]);

  const fetchSidebarData = async (userId: string) => {
    if (view === "chats") {
      const { data } = await supabase.from("messages")
        .select("sender_id, receiver_id").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      if (data) {
        const ids = Array.from(new Set(data.flatMap(m => [m.sender_id, m.receiver_id]))).filter(id => id !== userId);
        const { data: users } = await supabase.from("profiles").select("id, email").in("id", ids);
        setChats(users || []);
      }
    } else {
      const { data: users } = await supabase.from("profiles").select("id, email").neq("id", userId).limit(8);
      const { data: groups } = await supabase.from("groups").select("*").limit(8);
      setSuggestedUsers(users || []);
      setSuggestedGroups(groups || []);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("groups")
      .insert([{ name: groupName, description: groupDesc, created_by: currentUser.id }])
      .select().single();
    
    if (!error) {
      setSuggestedGroups([data, ...suggestedGroups]);
      setShowCreateGroup(false);
      setGroupName("");
      setGroupDesc("");
      alert("Group Created!");
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTarget || !currentUser) return;

    const isGroup = !("email" in selectedTarget);
    const payload = {
      text: newMessage,
      sender_id: currentUser.id,
      receiver_id: isGroup ? null : selectedTarget.id,
      group_id: isGroup ? selectedTarget.id : null
    };

    const { error } = await supabase.from("messages").insert([payload]);
    if (!error) {
      setNewMessage("");
      // Optimistic update for better "feel"
      const tempMsg: Message = { ...payload, id: Math.random().toString(), created_at: new Date().toISOString() };
      setMessages(prev => [...prev, tempMsg]);
    }
  };

  return (
    <div className="messenger-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="tabs">
            <button className={view === "chats" ? "active" : ""} onClick={() => setView("chats")}>Inbox</button>
            <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>Explore</button>
          </div>
        </div>

        <div className="sidebar-content">
          {view === "chats" ? (
            chats.map(u => (
              <div key={u.id} className={`item ${selectedTarget?.id === u.id ? 'active' : ''}`} onClick={() => setSelectedTarget(u)}>
                {u.email.split('@')[0]}
              </div>
            ))
          ) : (
            <div className="explore-view">
              <button className="create-group-btn" onClick={() => setShowCreateGroup(true)}>+ Create New Group</button>
              
              <h4>Suggested Pros</h4>
              {suggestedUsers.map(u => (
                <div key={u.id} className="suggest-card">
                  <span>{u.email.split('@')[0]}</span>
                  <button onClick={() => { setSelectedTarget(u); setView("chats"); }}>Chat</button>
                </div>
              ))}

              <h4>Communities</h4>
              {suggestedGroups.map(g => (
                <div key={g.id} className="suggest-card">
                  <span>{g.name}</span>
                  <button className="join-btn" onClick={() => setSelectedTarget(g)}>View</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="chat-window">
        {selectedTarget ? (
          <>
            <div className="chat-header">{"email" in selectedTarget ? selectedTarget.email : `Community: ${selectedTarget.name}`}</div>
            <div className="message-list">
              {messages.map(m => (
                <div key={m.id} className={`msg ${m.sender_id === currentUser?.id ? 'sent' : 'received'}`}>{m.text}</div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form className="input-area" onSubmit={sendMessage}>
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Write message..." />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="empty">Select a conversation to start pro-connecting</div>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      {showCreateGroup && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={handleCreateGroup}>
            <h3>Setup Pro Group</h3>
            <input placeholder="Group Name (e.g. Nairobi Plumbers)" value={groupName} onChange={e => setGroupName(e.target.value)} required />
            <textarea placeholder="What is this group for?" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} />
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCreateGroup(false)}>Cancel</button>
              <button type="submit" className="confirm">Create Group</button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        .messenger-container { display: flex; height: 100vh; background: #0f172a; color: white; font-family: sans-serif; }
        .sidebar { width: 320px; border-right: 1px solid #1e293b; display: flex; flex-direction: column; background: #111827; }
        .tabs { display: flex; width: 100%; }
        .tabs button { flex: 1; padding: 15px; background: none; border: none; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; }
        .tabs button.active { color: #3b82f6; border-bottom: 2px solid #3b82f6; background: #1e293b; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 15px; }
        .item { padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 5px; background: #1e293b; }
        .item.active { background: #3b82f6; }
        .create-group-btn { width: 100%; padding: 10px; background: #10b981; border: none; border-radius: 8px; color: white; font-weight: bold; margin-bottom: 20px; cursor: pointer; }
        .suggest-card { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #1e293b; border-radius: 8px; margin-bottom: 8px; }
        .suggest-card button { background: #3b82f6; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; }
        .chat-window { flex: 1; display: flex; flex-direction: column; }
        .chat-header { padding: 20px; background: #111827; border-bottom: 1px solid #1e293b; }
        .message-list { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .msg { max-width: 70%; padding: 10px 15px; border-radius: 12px; font-size: 14px; }
        .sent { align-self: flex-end; background: #3b82f6; }
        .received { align-self: flex-start; background: #334155; }
        .input-area { padding: 20px; display: flex; gap: 10px; border-top: 1px solid #1e293b; }
        .input-area input { flex: 1; padding: 12px; background: #1e293b; border: none; color: white; border-radius: 8px; }
        .input-area button { background: #3b82f6; border: none; color: white; padding: 0 20px; border-radius: 8px; cursor: pointer; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; }
        .modal { background: #1e293b; padding: 30px; border-radius: 16px; width: 400px; display: flex; flex-direction: column; gap: 15px; }
        .modal input, .modal textarea { padding: 10px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 8px; }
        .confirm { background: #3b82f6; border: none; padding: 10px; color: white; border-radius: 8px; cursor: pointer; }
        h4 { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 20px; }
      `}</style>
    </div>
  );
}


