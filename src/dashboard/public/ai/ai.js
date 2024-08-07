$(document).ready(function() {
    // Load the private key from local storage
    const savedVeridaKey = localStorage.getItem('veridaKey');
    $('#verida-key').val(savedVeridaKey);

    function getVeridaKey() {
        const veridaKey = $('#verida-key').val().trim();
        localStorage.setItem('veridaKey', veridaKey);
        return veridaKey;
    }

    function addMessage(content, type) {
        const messageClass = type === 'user' ? 'user' : 'bot';
        $('#chat-container').append(`
            <div class="message ${messageClass}">
                <div class="bubble">${marked.parse(content)}</div>
            </div>
        `);
        $('#chat-container').scrollTop($('#chat-container')[0].scrollHeight);
    }

    function showTypingIndicator() {
        $('#chat-container').append(`
            <div class="message bot typing">
                <div class="bubble">...</div>
            </div>
        `);
        $('#chat-container').scrollTop($('#chat-container')[0].scrollHeight);
    }

    function removeTypingIndicator() {
        $('.message.typing').remove();
    }

    function sendMessage(prompt) {
        const veridaKey = getVeridaKey();
        if (!veridaKey) {
            addMessage('Please enter your Verida key.', 'bot');
            return;
        }

        addMessage(prompt, 'user');
        showTypingIndicator();

        const body = { prompt: prompt, key: veridaKey };

        $.ajax({
            url: 'http://localhost:5022/llm/personal',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(body),
            success: function(response) {
                removeTypingIndicator();
                addMessage(response.result, 'bot'); // Adjust based on your API response structure
            },
            error: function(xhr) {
                removeTypingIndicator();
                addMessage('An error occurred. Please try again.', 'bot');
            }
        });
    }

    $('#send-btn').click(function() {
        const userInput = $('#user-input').val().trim();
        if (userInput) {
            sendMessage(userInput);
            $('#user-input').val('');
        }
    });

    $('#user-input').keypress(function(e) {
        if (e.which === 13) { // Enter key pressed
            $('#send-btn').click();
        }
    });

    // Hotload data
    const eventSource = new EventSource(`http://localhost:5022/minisearch/hotload?key=${savedVeridaKey}`);
    
    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const progressBar = $('#progress-bar');
        const statusMessage = $('#loading-overlay p');

        if (data.schema) {
            statusMessage.text(`${data.schema} (${data.status})`);
        }
        if (data.totalProgress) {
            const progressPercentage = Math.floor(data.totalProgress * 100);
            progressBar.css('width', `${progressPercentage}%`).attr('aria-valuenow', data.totalProgress);
        }
        if (data.status === 'Load Complete' && data.totalProgress >= 1) {
            $('#loading-overlay').fadeOut();
        }
    };

    eventSource.onerror = function(err) {
        $('#loading-overlay p').text('An error occurred while hotloading data.');
    };
});
