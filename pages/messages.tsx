"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "../src/lib/supabaseClient";

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<"chats" | "discover">("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. DATA INITIALIZATION
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setCurrentUser(user);

      // Parallel fetch to ensure we aren't waiting on one slow request
      const [resUsers, resGroups] = await Promise.all([
        supabase.from("profiles").select("*").neq("id", user.id),
        supabase.from("groups").select("*")
      ]);

      if (resUsers.error) console.error("User Fetch Error:", resUsers.error);
      
      setUsers(resUsers.data || []);
      setGroups(resGroups.data || []);
      setLoading(false);
    };
    loadData();
  }, []);

  // 2. SEARCH FILTERING
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (view === "chats") {
      return users.filter(u => u.full_name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query));
    }
    return groups.filter(g => g.name?.toLowerCase().includes(query));
  }, [searchQuery, users, groups, view]);

  // 3. REALTIME MESSAGING
  useEffect(() => {
    if (!selectedTarget || !currentUser) return;

    // Fetch History
    const fetchChat = async () => {
      let query = supabase.from("messages").select("*").order("created_at", { ascending: true });
      if ("email" in selectedTarget) {
        query = query.or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedTarget.id}),and(sender_id.eq.${selectedTarget.id},receiver_id.eq.${currentUser.id})`);
      } else {
        query = query.eq("group_id", selectedTarget.id);
      }
      const { data } = await query;
      setMessages(data || []);
    };
    fetchChat();

    // Subscribe
    const channel = supabase.channel(`chat_${selectedTarget.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        setMessages(prev => [...prev, payload.new]);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTarget, currentUser]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
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

  if (loading) return <div className="loader">Loading secure data...</div>;

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="view-toggle">
            <button className={view === "chats" ? "active" : ""} onClick={() => setView("chats")}>Inbox</button>
            <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>Explore</button>
          </div>
          
          <div className="search-container">
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="debug-info">
             Showing {filteredItems.length} of {view === "chats" ? users.length : groups.length} items
          </div>
        </div>

        <div className="list">
          {filteredItems.map(item => (
            <div 
              key={item.id} 
              className={`item ${selectedTarget?.id === item.id ? "selected" : ""}`}
              onClick={() => setSelectedTarget(item)}
            >
              <div className="avatar">{"full_name" in item ? item.full_name[0] : "#"}</div>
              <div className="item-text">
                <div className="name">{"full_name" in item ? item.full_name : item.name}</div>
                <div className="sub">{"category" in item ? item.category : "Community"}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* CHAT AREA */}
      <main className="chat">
        {selectedTarget ? (
          <>
            <div className="chat-header">
              {"full_name" in selectedTarget ? selectedTarget.full_name : selectedTarget.name}
            </div>
            <div className="messages">
              {messages.map(m => (
                <div key={m.id} className={`bubble ${m.sender_id === currentUser.id ? "me" : "them"}`}>
                  {m.text}
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={handleSend} className="input-area">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type here..." />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="empty-state">Select a contact to start</div>
        )}
      </main>

      <style jsx>{`
        .layout { display: flex; height: 100vh; background: #020617; color: white; font-family: sans-serif; }
        .sidebar { width: 320px; border-right: 1px solid #1e293b; display: flex; flex-direction: column; background: #020617; }
        .sidebar-header { padding: 15px; border-bottom: 1px solid #1e293b; }
        .view-toggle { display: flex; gap: 4px; background: #0f172a; padding: 4px; border-radius: 8px; margin-bottom: 12px; }
        .view-toggle button { flex: 1; padding: 8px; border: none; background: none; color: #64748b; cursor: pointer; border-radius: 6px; font-weight: bold; }
        .view-toggle button.active { background: #3b82f6; color: white; }
        .search-input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: white; margin-bottom: 8px; outline: none; }
        .search-input:focus { border-color: #3b82f6; }
        .debug-info { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px; }
        
        .list { flex: 1; overflow-y: auto; padding: 10px; }
        .item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; cursor: pointer; transition: 0.2s; }
        .item:hover { background: #0f172a; }
        .item.selected { background: #1e293b; border-left: 4px solid #3b82f6; }
        .avatar { width: 40px; height: 40px; background: #334155; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .name { font-size: 14px; font-weight: 600; }
        .sub { font-size: 11px; color: #64748b; }

        .chat { flex: 1; display: flex; flex-direction: column; background: #0f172a; }
        .chat-header { padding: 20px; border-bottom: 1px solid #1e293b; font-weight: bold; background: #020617; }
        .messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .bubble { max-width: 70%; padding: 10px 15px; border-radius: 12px; font-size: 14px; }
        .bubble.me { align-self: flex-end; background: #2563eb; }
        .bubble.them { align-self: flex-start; background: #1e293b; border: 1px solid #334155; }
        .input-area { padding: 20px; display: flex; gap: 10px; background: #020617; border-top: 1px solid #1e293b; }
        .input-area input { flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; color: white; outline: none; }
        .input-area button { background: #3b82f6; color: white; border: none; padding: 0 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: #475569; }
      `}</style>
    </div>
  );
}
