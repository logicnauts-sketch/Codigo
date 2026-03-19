/**
 * Next Design - Session Guard
 * -------------------------
 * Prevents accidental browser closure and maintains backend heartbeat.
 */

(function() {
    console.log("Next Design Session Guard: Active");

    // 1. CONFIRMATION ON CLOSURE
    window.addEventListener('beforeunload', function (e) {
        // Most modern browsers ignore the custom message and show a generic one
        const confirmationMessage = 'Â¿Estás seguro de que quieres salir? El sistema podría cerrarse.';
        
        // standard way to show a confirmation dialog
        (e || window.event).returnValue = confirmationMessage; 
        return confirmationMessage;
    });

    // 2. HEARTBEAT SYSTEM
    const HEARTBEAT_INTERVAL = 20000; // 20 seconds
    
    function sendHeartbeat() {
        fetch('/api/system/heartbeat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                console.warn("Heartbeat failed, server might be offline.");
            }
        })
        .catch(error => {
            console.error("Critical error sending heartbeat:", error);
        });
    }

    // Send first heartbeat immediately
    sendHeartbeat();
    
    // Set interval for subsequent heartbeats
    setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

})();

