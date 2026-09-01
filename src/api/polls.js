import apiClient from './client';

export const pollsApi = {
  // GET /api/polls/active
  // Returns today's poll, current phase, and the calling user's own response.
  getActive: async () => {
    const response = await apiClient.get('/polls/active');
    return response.data; // { success, data: { poll, phase, my_response } }
  },

  // POST /api/polls/:id/respond
  // Body: { response: 'yes' | 'no' }
  submitVote: async (pollId, vote) => {
    const response = await apiClient.post(`/polls/${pollId}/respond`, { response: vote });
    return response.data;
  },

  // GET /api/polls/my-responses
  // Paginated personal vote history
  getMyResponses: async (page = 1, limit = 20) => {
    const response = await apiClient.get('/polls/my-responses', { params: { page, limit } });
    return response.data;
  },
};
