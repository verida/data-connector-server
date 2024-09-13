$(document).ready(function() {
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

        const urlType = $('#privateData-input').prop('checked') ? "personal" : 
        "prompt";

        const body = { prompt: prompt, key: veridaKey };

        $.ajax({
            url: `/api/v1/llm/${urlType}?key=${veridaKey}`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(body),
            success: function(response) {
                removeTypingIndicator();
                addMessage(urlType == "personal" ? response.result : response.result.choices[0].message.content, 'bot');
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
    const eventSource = new EventSource(`/api/v1/llm/hotload?key=${savedVeridaKey}`);
    
    let loadComplete = false
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
            loadComplete = true
            $('#loading-overlay').fadeOut();
            eventSource.close()
        }
    };

    eventSource.onerror = function(err) {
        if (loadComplete) {
            return
        }
        
        $('#loading-overlay p').text('An error occurred while hotloading data.');
    };
});
