import { create } from 'zustand';
import * as chatApi from '../api/chatApi';
import { apiErrorMessage } from './../api/axiosInstance';

const initial = {
  projectId: null,
  conversation: null,
  messages: [],
  loading: false,
  sending: false,
  applying: null,
  error: null,
};

export const useChatStore = create((set, get) => ({
  ...initial,

  reset() {
    set({ ...initial });
  },

  /**
   * Opens this project's planning thread, creating it on first use.
   *
   * A thread nobody asked for is not created on page load — only when the
   * panel is actually opened, so browsing a plan does not litter the database
   * with empty conversations.
   */
  async open(projectId) {
    if (get().projectId === projectId && get().conversation) return;

    set({ ...initial, projectId, loading: true });
    try {
      const threads = await chatApi.listConversations(projectId);
      const existing = threads.find((t) => t.topic === 'planning');
      const conversation = existing ?? (await chatApi.createConversation(projectId, 'planning'));

      const messages = existing
        ? (await chatApi.getConversation(projectId, conversation._id)).messages
        : [];

      set({ conversation, messages, loading: false });
    } catch (err) {
      set({ loading: false, error: apiErrorMessage(err, 'Could not open the conversation') });
    }
  },

  async send(content) {
    const { projectId, conversation, sending } = get();
    if (!projectId || !conversation || sending) return;

    const text = content.trim();
    if (!text) return;

    // Shown immediately with a temporary id, then replaced by what the server
    // stored. Waiting for a round trip to see your own words reads as a hang.
    const pending = {
      _id: `pending-${Date.now()}`,
      role: 'user',
      content: text,
      status: 'none',
      pending: true,
    };
    set((s) => ({ messages: [...s.messages, pending], sending: true, error: null }));

    try {
      const { message, reply } = await chatApi.sendMessage(projectId, conversation._id, text);
      set((s) => ({
        messages: [...s.messages.filter((m) => m._id !== pending._id), message, reply].filter(
          Boolean
        ),
        sending: false,
      }));
    } catch (err) {
      set((s) => ({
        messages: s.messages.filter((m) => m._id !== pending._id),
        sending: false,
        error: apiErrorMessage(err, 'The message could not be sent'),
      }));
    }
  },

  /**
   * Accepts a proposal and hands the new plan back to the caller.
   *
   * The plan store is not written from here: the page owns the plan, knows
   * whether it has unsaved edits, and is the one that must flush them before
   * the server writes on top of what it has stored.
   */
  async apply(messageId) {
    const { projectId, conversation } = get();
    if (!projectId || !conversation) return null;

    set({ applying: messageId, error: null });
    try {
      const { message, plan } = await chatApi.applyProposal(projectId, conversation._id, messageId);
      set((s) => ({
        messages: s.messages.map((m) => (m._id === messageId ? message : m)),
        applying: null,
      }));
      return plan;
    } catch (err) {
      set({ applying: null, error: apiErrorMessage(err, 'Could not apply that change') });
      return null;
    }
  },

  async discard(messageId) {
    const { projectId, conversation } = get();
    if (!projectId || !conversation) return;

    try {
      const message = await chatApi.discardProposal(projectId, conversation._id, messageId);
      set((s) => ({ messages: s.messages.map((m) => (m._id === messageId ? message : m)) }));
    } catch (err) {
      set({ error: apiErrorMessage(err, 'Could not discard that change') });
    }
  },

  async clear() {
    const { projectId, conversation } = get();
    if (!projectId || !conversation) return;

    try {
      await chatApi.deleteConversation(projectId, conversation._id);
      const fresh = await chatApi.createConversation(projectId, 'planning');
      set({ conversation: fresh, messages: [], error: null });
    } catch (err) {
      set({ error: apiErrorMessage(err, 'Could not clear the conversation') });
    }
  },

  dismissError() {
    set({ error: null });
  },
}));
