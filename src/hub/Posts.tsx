import { useRef, useState } from "react";
import { block, createPost, deletePost, mediaUrl, report, type HubPost } from "./api";
import { mediaProblem } from "./format";

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function Composer({ userId, eventId, onPosted }: { userId: string; eventId?: string; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | undefined>();
  const [preview, setPreview] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const choose = (f: File | undefined) => {
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setFile(undefined);
      setPreview(undefined);
      return;
    }
    const problem = mediaProblem(f);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const post = async () => {
    if (!body.trim() && !file) return;
    setBusy(true);
    setError("");
    try {
      await createPost(userId, body, file, eventId);
      setBody("");
      choose(undefined);
      if (input.current) input.current.value = "";
      onPosted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="composer card"
      onSubmit={(e) => {
        e.preventDefault();
        void post();
      }}
    >
      <label className="visually-hidden" htmlFor={`compose-${eventId ?? "feed"}`}>Write a post</label>
      <textarea
        id={`compose-${eventId ?? "feed"}`}
        rows={2}
        maxLength={1000}
        placeholder={eventId ? "Share a photo or note from this event" : "Share your workout"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {preview && file && (
        <div className="composer-media">
          {file.type.startsWith("video/") ? <video src={preview} controls playsInline /> : <img src={preview} alt="Selected photo" />}
          <button type="button" className="ghost small" onClick={() => choose(undefined)}>Remove</button>
        </div>
      )}
      {error && <p className="warn">{error}</p>}
      <div className="composer-actions">
        <label className="secondary small file-btn">
          Photo or video
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>
        <button type="submit" className="primary small" disabled={busy || (!body.trim() && !file)}>
          {busy ? (file ? "Uploading…" : "Posting…") : "Post"}
        </button>
      </div>
    </form>
  );
}

export function PostList({
  posts,
  userId,
  eventOwnerId,
  onChanged,
  onOpenEvent,
}: {
  posts: HubPost[];
  userId: string;
  eventOwnerId?: string;
  onChanged: () => void;
  onOpenEvent?: (id: string) => void;
}) {
  if (posts.length === 0) return <p className="empty">No posts yet. Be the first to share one.</p>;
  return (
    <ul className="posts">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} userId={userId} canDelete={p.author_id === userId || eventOwnerId === userId} onChanged={onChanged} onOpenEvent={onOpenEvent} />
      ))}
    </ul>
  );
}

function PostCard({
  post,
  userId,
  canDelete,
  onChanged,
  onOpenEvent,
}: {
  post: HubPost;
  userId: string;
  canDelete: boolean;
  onChanged: () => void;
  onOpenEvent?: (id: string) => void;
}) {
  const [menu, setMenu] = useState<"closed" | "open" | "report" | "done">("closed");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const run = async (action: () => Promise<void>, after: typeof menu = "closed") => {
    setError("");
    try {
      await action();
      setMenu(after);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <li className="post card">
      <div className="post-head">
        <span className="avatar" aria-hidden="true">{post.author_name.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{post.author_name}</strong>
          <p className="muted">
            {ago(post.created_at)}
            {post.event_title && post.event_id && onOpenEvent && (
              <> · <button type="button" className="link" onClick={() => onOpenEvent(post.event_id!)}>{post.event_title}</button></>
            )}
          </p>
        </div>
        <button type="button" className="icon-btn more" aria-label="Post options" aria-expanded={menu !== "closed"} onClick={() => setMenu(menu === "closed" ? "open" : "closed")}>
          ⋯
        </button>
      </div>
      {post.body && <p className="post-body">{post.body}</p>}
      {post.media_path && post.media_type === "image" && <img className="post-media" src={mediaUrl(post.media_path)} alt={`Photo shared by ${post.author_name}`} loading="lazy" />}
      {post.media_path && post.media_type === "video" && <video className="post-media" src={mediaUrl(post.media_path)} controls playsInline preload="metadata" />}

      {menu === "open" && (
        <div className="post-menu">
          {canDelete && <button type="button" className="ghost small danger-text" onClick={() => run(() => deletePost(post))}>Delete post</button>}
          {post.author_id !== userId && (
            <>
              <button type="button" className="ghost small" onClick={() => setMenu("report")}>Report</button>
              <button type="button" className="ghost small" onClick={() => run(() => block(post.author_id))}>Block {post.author_name}</button>
            </>
          )}
        </div>
      )}
      {menu === "report" && (
        <form className="post-menu report" onSubmit={(e) => { e.preventDefault(); void run(() => report({ postId: post.id }, reason.trim()), "done"); }}>
          <label className="field">
            What's wrong with this post?
            <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. spam, harassment, unsafe" />
          </label>
          <div className="tip-actions">
            <button type="submit" className="primary small" disabled={reason.trim().length < 2}>Send report</button>
            <button type="button" className="ghost small" onClick={() => setMenu("closed")}>Cancel</button>
          </div>
        </form>
      )}
      {menu === "done" && <p className="muted">Thanks. Posts reported by several people are hidden until reviewed.</p>}
      {error && <p className="warn">{error}</p>}
    </li>
  );
}
