"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../src/lib/supabaseClient";


export default function AddEditService() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams?.get("id") ?? null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [provider, setProvider] = useState("");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [warning, setWarning] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  // 1. Add these new states
const [mediaFiles, setMediaFiles] = useState<File[]>([]);
const [previews, setPreviews] = useState<string[]>([]);

// 2. Handle file selection
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  setMediaFiles(prev => [...prev, ...files]);

  // Create local URLs so the user can see what they uploaded before posting
  const newPreviews = files.map(file => URL.createObjectURL(file));
  setPreviews(prev => [...prev, ...newPreviews]);
};

// 3. Icons for Media
const MediaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);

  // ---------------- Auth Guard ----------------
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        router.push("/auth/login");
        return;
      }
      if (!user.email_confirmed_at) {
        router.push("/auth/verify-email");
        return;
      }
      setCurrentUser(user.id);
      if (serviceId) fetchService();
    };
    checkAuth();
  }, [serviceId]);

  // ---------------- Fetch service for edit ----------------
  const fetchService = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setTitle(data.title);
    setDescription(data.description);
    setCategory(data.category);
    setProvider(data.provider);
    setContact(data.contact);
    setLocation(data.location);
  };

const handleSave = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrorMsg("");
  setWarning("");
  setLoading(true);

  try {
    // 1. Upload Media Files first (Images/Videos)
    const uploadedUrls: string[] = [];
    
    // mediaFiles is the state holding your selected File objects
    for (const file of mediaFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `service-media/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments") // Ensure this bucket exists
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(filePath);

      uploadedUrls.push(urlData.publicUrl);
    }

    // 2. Prepare the data object
    const serviceData = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      provider: provider.trim(),
      contact: contact.trim(),
      location: location.trim(),
      media_urls: uploadedUrls, // Array of image/video links
    };

    // 3. Update or Insert
    if (serviceId) {
      const { error } = await supabase
        .from("services")
        .update(serviceData)
        .eq("id", serviceId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("services")
        .insert([{ ...serviceData, owner_id: currentUser }]);

      if (error) throw error;
    }

    router.push("/");
  } catch (error: any) {
    setErrorMsg(error.message || "An error occurred");
  } finally {
    setLoading(false);
  }
};

  // ---------------- Delete ----------------
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    setLoading(true);
    const { error } = await supabase.from("services").delete().eq("id", serviceId);
    setLoading(false);
    if (error) return setErrorMsg(error.message);
    router.push("/");
  };

  return (


    <div className="page">


      <div className="card">
                    <button
    className="back-btn"
    onClick={() => router.push("/")}
    aria-label="Go back"
  >
    ←
  </button>

        <h2 className="title">{serviceId ? "Edit Service" : "Add a Service"}</h2>

        {errorMsg && <p className="error">{errorMsg}</p>}
        {warning && <p className="warning">{warning}</p>}

        <form className="form" onSubmit={handleSave}>
          <input
            type="text"
            placeholder="Service Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input"
          />
<div className="input-group">
  <textarea
    placeholder="Description"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    required
    className="textarea"
    rows={4}
  />

  {/* Preview Grid */}
  <div className="preview-grid">
    {previews.map((src, index) => (
      <div key={index} className="preview-item">
        {mediaFiles[index]?.type.startsWith('video') ? (
          <video src={src} className="media-preview" />
        ) : (
          <img src={src} alt="preview" className="media-preview" />
        )}
      </div>
    ))}
  </div>

  <div className="form-actions">
    <label className="media-upload-label">
      <MediaIcon />
      <span>Add Photo/Video</span>
      <input 
        type="file" 
        accept="image/*,video/*" 
        multiple 
        hidden 
        onChange={handleFileChange} 
      />
    </label>
  </div>
</div>
          <input
            type="text"
            placeholder="Category (e.g. Cleaning)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="input"
          />

          <input
            type="text"
            placeholder="Job Location (e.g. Nairobi)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="input"
          />

          <button type="submit" disabled={loading} className="button">
            {loading ? "Saving..." : serviceId ? "Update Service" : "Add Service"}
          </button>

          {serviceId && (
            <button type="button" onClick={handleDelete} className="delete">
              🗑️ Delete Service
            </button>
          )}
        </form>
      </div>

      <style jsx>{`
        .page {
          background: white;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .card {
          background: white;
          padding: 30px;
          border-radius: 16px;
          border: 1px solid black;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }
          .back-btn {
  background: transparent;
  border: 1px solid black;
  
  position: sticky;
  color: #070707;
  font-size: 26px;
  font-weight: 700;
  cursor: pointer;
  padding: 6px 10px;
  margin-right: 6px;
  border-radius: 8px;
  transition: background 0.2s ease, transform 0.1s ease;
}
  .preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
  margin: 10px 0;
}

.media-preview {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.media-upload-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #2402ff;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 8px;
  border: 1px dashed #2402ff;
  border-radius: 8px;
  width: fit-content;
}
        .title {
          text-align: center;
          font-size: 26px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .input,
        .textarea {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #ccc;
          font-size: 16px;
        }
        .button {
          background: #2563eb;
          color: white;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
        }
        .button:hover {
          background: #1d4ed8;
        }
        .delete {
          background: #dc2626;
          color: white;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 10px;
        }
        .delete:hover {
          opacity: 0.85;
        }
        .error {
          background: #dc2626;
          color: white;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 10px;
          text-align: center;
        }
        .warning {
          background: #facc15;
          color: #111;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 10px;
          text-align: center;
        }
      `}</style>
    </div>
  );
  }

