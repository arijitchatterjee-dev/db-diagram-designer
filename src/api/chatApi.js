import api from './axiosInstance';

/**
 * The planning conversation.
 *
 * A thread belongs to a project, and every message carries the project's plan
 * as context on the server side — that is the whole point of the thing, and
 * why the client never has to send the plan itself.
 */
export async function listConversations(projectId) {
  const { data } = await api.get(`/projects/${projectId}/conversations`);
  return data.conversations;
}

export async function createConversation(projectId, topic = 'planning') {
  const { data } = await api.post(`/projects/${projectId}/conversations`, { topic });
  return data.conversation;
}

export async function getConversation(projectId, conversationId) {
  const { data } = await api.get(`/projects/${projectId}/conversations/${conversationId}`);
  return { conversation: data.conversation, messages: data.messages };
}

export async function deleteConversation(projectId, conversationId) {
  await api.delete(`/projects/${projectId}/conversations/${conversationId}`);
}

/**
 * Asks a question and waits for the answer.
 *
 * The reply comes back on the same response rather than as a second request:
 * the server writes both turns, so a client that dropped the connection
 * halfway still finds the answer in the thread when it comes back.
 */
export async function sendMessage(projectId, conversationId, content) {
  const { data } = await api.post(
    `/projects/${projectId}/conversations/${conversationId}/messages`,
    { role: 'user', content },
    // A model turn can take a while, and the default would give up on it.
    { timeout: 240000 }
  );
  return { message: data.message, reply: data.reply ?? null };
}

/**
 * Accepts a proposal.
 *
 * The plan comes back on the response so the page can take it straight away
 * rather than refetching, which would race the autosave.
 */
export async function applyProposal(projectId, conversationId, messageId) {
  const { data } = await api.post(
    `/projects/${projectId}/conversations/${conversationId}/messages/${messageId}/apply`
  );
  return { message: data.message, plan: data.plan };
}

export async function discardProposal(projectId, conversationId, messageId) {
  const { data } = await api.post(
    `/projects/${projectId}/conversations/${conversationId}/messages/${messageId}/discard`
  );
  return data.message;
}
