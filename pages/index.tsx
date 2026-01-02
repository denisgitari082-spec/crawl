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
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Setup User and Load Discovery Data immediately
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        // Force profile creation so you are searchable
        await supabase.from("profiles").upsert({ id: user.id, email: user.email });
        
        // Load Discovery Data (Users & Groups)
        const { data: uData } = await supabase.from("profiles").select("id, email").neq("id", user.id).limit(10);
        const { data: gData } = await supabase.from("groups").select("*").limit(10);
        setSuggestedUsers(uData || []);
        setSuggestedGroups(gData || []);

        // Load existing chat history list
        fetchChatHistory(user.id);
      }
    };
    init();
  }, []);

  const fetchChatHistory = async (userId: string) => {
    const { data } = await supabase.from("messages").select("sender_id, receiver_id").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (data) {
      const ids = Array.from(new Set(data.flatMap(m => [m.sender_id, m.receiver_id]))).filter(id => id !== userId);
      const { data: users } = await supabase.from("profiles").select("id, email").in("id", ids);
      setChats(users || []);
    }
  };

  // 2. Fetch Messages when a user/group is selected
  useEffect(() => {
    if (!selectedTarget || !currentUser) return;
    
    const loadMsgs = async () => {
      let query = supabase.from("messages").select("*").order("created_at", { ascending: true });
      if ("email" in selectedTarget) {
        query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedTarget.id}),and(sender_id.eq.${selectedTarget.id},receiver_id.eq.${currentUser.id})`);
      } else {
        query = query.eq("group_id", selectedTarget.id);
      }
      const { data } = await query;
      setMessages(data || []);
    };
    loadMsgs();

    // Subscribe to new messages
    const channel = supabase.channel('realtime-msgs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTarget, currentUser]);

  // 3. ACTUAL Send Function
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

    if (!error) {
      setNewMessage("");
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      alert("Error sending: " + error.message);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from("groups")
      .insert([{ name: groupName, description: groupDesc, created_by: currentUser.id }])
      .select().single();
    
    if (!error) {
      setSuggestedGroups(prev => [data, ...prev]);
      setShowCreateGroup(false);
      setGroupName("");
      setGroupDesc("");
      setSelectedTarget(data);
    }
  };

  return (
    <div className="messenger-container">
      <div className="sidebar">
        <div className="tabs">
          <button className={view === "chats" ? "active" : ""} onClick={() => setView("chats")}>Inbox</button>
          <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>Explore</button>
        </div>

        <div className="sidebar-content">
          {view === "chats" ? (
            <>
              <h4>Suggested to Chat</h4>
              {suggestedUsers.map(u => (
                <div key={u.id} className={`item ${selectedTarget?.id === u.id ? 'active' : ''}`} onClick={() => setSelectedTarget(u)}>
                  {u.email.split('@')[0]} <small>• New</small>
                </div>
              ))}
              {chats.length > 0 && <h4>Recent Chats</h4>}
              {chats.map(u => (
                <div key={u.id} className={`item ${selectedTarget?.id === u.id ? 'active' : ''}`} onClick={() => setSelectedTarget(u)}>
                  {u.email.split('@')[0]}
                </div>
              ))}
            </>
          ) : (
            <div className="explore-view">
              <button className="create-group-btn" onClick={() => setShowCreateGroup(true)}>+ Create New Group</button>
              <h4>Public Groups</h4>
              {suggestedGroups.map(g => (
                <div key={g.id} className={`item ${selectedTarget?.id === g.id ? 'active' : ''}`} onClick={() => setSelectedTarget(g)}>
                  {g.name}
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
                <strong>{"email" in selectedTarget ? selectedTarget.email : selectedTarget.name}</strong>
            </div>
            <div className="message-list">
              {messages.map(m => (
                <div key={m.id} className={`msg ${m.sender_id === currentUser?.id ? 'sent' : 'received'}`}>{m.text}</div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form className="input-area" onSubmit={sendMessage}>
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="empty">Select a user from Inbox or a Group from Explore</div>
        )}
      </div>

      {showCreateGroup && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={handleCreateGroup}>
            <h3>New Group</h3>
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
        .sidebar { width: 300px; border-right: 1px solid #1e293b; display: flex; flex-direction: column; background: #111827; }
        .tabs { display: flex; border-bottom: 1px solid #1e293b; }
        .tabs button { flex: 1; padding: 15px; background: none; border: none; color: #64748b; cursor: pointer; }
        .tabs button.active { color: #3b82f6; border-bottom: 2px solid #3b82f6; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 15px; }
        .item { padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 8px; background: #1e293b; font-size: 14px; }
        .item:hover { background: #334155; }
        .item.active { background: #3b82f6; }
        .create-group-btn { width: 100%; padding: 12px; background: #10b981; border: none; border-radius: 8px; color: white; font-weight: bold; margin-bottom: 20px; cursor: pointer; }
        .chat-window { flex: 1; display: flex; flex-direction: column; }
        .chat-header { padding: 20px; border-bottom: 1px solid #1e293b; background: #111827; }
        .message-list { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .msg { max-width: 70%; padding: 10px 15px; border-radius: 12px; font-size: 14px; }
        .sent { align-self: flex-end; background: #3b82f6; }
        .received { align-self: flex-start; background: #334155; }
        .input-area { padding: 20px; display: flex; gap: 10px; border-top: 1px solid #1e293b; }
        .input-area input { flex: 1; padding: 12px; background: #1e293b; border: none; color: white; border-radius: 8px; outline: none; }
        .input-area button { background: #3b82f6; border: none; color: white; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #1e293b; padding: 25px; border-radius: 12px; width: 350px; display: flex; flex-direction: column; gap: 15px; }
        .modal input, .modal textarea { padding: 10px; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 6px; }
        .confirm { background: #3b82f6; border: none; padding: 10px; color: white; border-radius: 6px; cursor: pointer; }
        h4 { font-size: 11px; color: #4b5563; text-transform: uppercase; margin: 15px 0 10px 0; }
        .empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #4b5563; }
      `}</style>
    </div>
  );
}
