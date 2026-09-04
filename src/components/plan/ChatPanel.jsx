import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  CircleNotch,
  Sparkle,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { useChatStore } from '../../store/useChatStore';
import ProposalCard from './ProposalCard';

const SUGGESTIONS = [
  'Is this stack right for what I described?',
  'What has this plan not thought about yet?',
  'Which module should I build first?',
];

/**
 * The planning conversation, docked beside the plan.
 *
 * Every message carries the current plan as context on the server, which is
 * the whole point: the reason planning in a chat window does not work is that
 * you spend the first ten minutes explaining the project, every time.
 */
export default function ChatPanel({ projectId, onClose, onApplied }) {
  const conversation = useChatStore((s) => s.conversation);
  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const open = useChatStore((s) => s.open);
  const send = useChatStore((s) => s.send);
  const clear = useChatStore((s) => s.clear);
  const applying = useChatStore((s) => s.applying);
  const apply = useChatStore((s) => s.apply);
  const discard = useChatStore((s) => s.discard);

  const [draft, setDraft] = useState('');
  const scroller = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    open(projectId);
  }, [projectId, open]);

  // Follows the conversation down as it grows, including while a reply is
  // being waited on so the spinner stays in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    if (!loading) input.current?.focus();
  }, [loading]);

  function submit(e) {
    e?.preventDefault();
    if (sending || !draft.trim()) return;
    send(draft);
    setDraft('');
  }

  // Enter sends, Shift+Enter is a newline: this is a conversation, and the
  // common case is one paragraph.
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) submit(e);
  }

  const empty = !loading && messages.length === 0;

  return (
    <aside className="chat" aria-label="Planning conversation">
      <header className="chat__head">
        <span className="chat__title">
          <Sparkle size={14} weight="fill" />
          Planning
        </span>
        <span className="chat__spacer" />
        {messages.length > 0 && (
          <button type="button" className="chat__icon" onClick={clear} title="Start a new thread">
            <Trash size={14} weight="bold" />
          </button>
        )}
        <button type="button" className="chat__icon" onClick={onClose} title="Close">
          <X size={14} weight="bold" />
        </button>
      </header>

      <div className="chat__body" ref={scroller}>
        {loading && (
          <p className="chat__note">
            <CircleNotch size={14} weight="bold" className="spin" />
            Opening
          </p>
        )}

        {empty && (
          <div className="chat__empty">
            <p>
              Ask about this project. The plan on the left travels with every message,
              so you never have to explain it.
            </p>
            <div className="chat__suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Bubble
            key={m._id}
            message={m}
            busy={applying === m._id}
            onApply={() => onApplied(() => apply(m._id))}
            onDiscard={() => discard(m._id)}
          />
        ))}

        {sending && (
          <p className="chat__note">
            <CircleNotch size={14} weight="bold" className="spin" />
            Thinking
          </p>
        )}
      </div>

      {error && (
        <p className="chat__error" role="alert">
          <WarningCircle size={14} weight="fill" />
          {error}
        </p>
      )}

      <form className="chat__foot" onSubmit={submit}>
        <textarea
          ref={input}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={conversation ? 'Ask about this plan' : 'Opening'}
          disabled={loading || !conversation}
        />
        <button type="submit" disabled={sending || !draft.trim()} aria-label="Send">
          <ArrowUp size={15} weight="bold" />
        </button>
      </form>
    </aside>
  );
}

function Bubble({ message, busy, onApply, onDiscard }) {
  const mine = message.role === 'user';

  // A failed turn stays in the thread rather than vanishing: the question was
  // asked either way, and what went wrong belongs next to it.
  if (message.error) {
    return (
      <div className="chat__msg chat__msg--failed">
        <WarningCircle size={14} weight="fill" />
        <span>{message.error}</span>
      </div>
    );
  }

  return (
    <div className={`chat__msg${mine ? ' chat__msg--mine' : ''}${message.pending ? ' is-pending' : ''}`}>
      {message.content
        .split('\n\n')
        .filter(Boolean)
        .map((para, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <p key={i}>{para}</p>
        ))}

      {message.diff?.length > 0 && (
        <ProposalCard message={message} busy={busy} onApply={onApply} onDiscard={onDiscard} />
      )}
    </div>
  );
}
