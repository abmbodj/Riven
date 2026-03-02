/**
 * Stripe API wrapper for the client.
 */
export async function getManagementPortalUrl() {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/stripe/create-portal-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        return data.url;
    } catch (error) {
        console.error('[Stripe] Failed to get portal URL:', error);
        return null;
    }
}
