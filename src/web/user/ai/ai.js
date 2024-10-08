$(document).ready(function() {
    const veridaKey = localStorage.getItem('veridaKey');

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
            url: `/api/rest/v1/llm/${urlType}?key=${veridaKey}`,
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
    const eventSource = new EventSource(`/api/rest/v1/llm/hotload?key=${veridaKey}`);

    let loadComplete = false
    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const progressBar = $('#progress-bar');
        const statusMessage = $('#loading-overlay p');

        if (data.success == false) {
            $('#loading-overlay p').text(`Error from server: ${data.error}`);
            eventSource.close()
        } else {
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
        }
    };

    eventSource.onerror = function(event) {
        if (loadComplete) {
            return
        }

        $('#send-btn').prop('disabled', true)
        $('#user-input').prop('disabled', true)

        console.debug(event)

        let errorMessage = 'An unknown error occurred while hotloading data.';
        if (event.data) {
            try {
                const errorData = JSON.parse(event.data);
                // FIXME: The event doesn't have the error data
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                console.error('Error parsing error data:', e);
            }
        }

        $('#errorMessage').text(errorMessage);
        $('#errorAlert').removeClass('d-none')

        $('#loading-overlay p').text(errorMessage);

        $('#loading-overlay').fadeOut();
    };
});
