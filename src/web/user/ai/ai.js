$(document).ready(function() {
    const veridaKey = localStorage.getItem('veridaKey');
    const customLLMString = localStorage.getItem('customLLM')
    if (customLLMString) {
        const customLLM = JSON.parse(customLLMString)
        $('#byo-endpoint').val(customLLM.endpoint);
        $('#byo-auth-key').val(customLLM.authKey);
        $('#byo-model').val(customLLM.model);
    }

    const llmPlatform = localStorage.getItem('llmPlatform')
    if (llmPlatform) {
        $('#platform-select').val(llmPlatform)
    } else {
        $('#platform-select').val('bedrock')
    }

    const llmModel = localStorage.getItem('llmModel')

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

        const body = {
            prompt: prompt,
            key: veridaKey
        };

        $.ajax({
            url: `/api/rest/v1/llm/agent?key=${veridaKey}`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(body),
            success: function(response) {
                removeTypingIndicator();
                addMessage(response.response.output, 'bot');
            },
            error: function(xhr) {
                console.log(xhr)
                removeTypingIndicator();
                addMessage(`An error occurred. Please try again.\n\n\`${xhr.responseText}\``, 'bot');
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

    $('#user-input').keyup(function(e) {
        if (e.which === 13) { // Enter key pressed
            $('#send-btn').click();
            $('#user-input').val('');
        }
    });

    // Hotload data
    const eventSource = new EventSource(`/api/rest/v1/llm/hotload?key=${veridaKey}&keywordIndex=true`);

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

    // // Function to populate models based on platform
    // function populateModels(platform, selectedModel, dontShowModal) {
    //     const modelSelect = $('#model-select');
    //     modelSelect.empty(); // Clear current options

    //     if (platform in ProviderModels) {
    //         $('.model-form-input').show();
    //         const models = ProviderModels[platform];
    //         $.each(models, function (modelName, modelValue) {
    //             modelSelect.append(new Option(modelName.replace(/_/g, ' '), modelValue));
    //         });
    //     } else if (platform === 'byo-llm') {
    //         // Trigger the modal for BYO LLM
    //         if (!dontShowModal) {
    //             $('#byoLlmModal').modal('show');
    //         }

    //         $('.model-form-input').hide();
    //     }

    //     if (selectedModel) {
    //         modelSelect.val(selectedModel)
    //     }
    // }

    // Event listener for platform selection
    // $('#platform-select').on('change', function() {
    //     const selectedPlatform = $(this).val();
    //     localStorage.setItem('llmPlatform', selectedPlatform)
    //     populateModels(selectedPlatform);
    //     const selectedModel = $('#model-select').val();
    //     localStorage.setItem('llmModel', selectedModel)
    // });

    // Event listener for model selection
    // $('#model-select').on('change', function() {
    //     const selectedModel = $(this).val();
    //     localStorage.setItem('llmModel', selectedModel)
    // });

    // Handle "Save" action from the BYO LLM modal
    // $('#save-byo-llm').on('click', function() {
    //     const endpoint = $('#byo-endpoint').val();
    //     const authKey = $('#byo-auth-key').val();
    //     const model = $('#byo-model').val();

    //     const customLLLM = {
    //         endpoint,
    //         authKey,
    //         model
    //     }

    //     localStorage.setItem('customLLM', JSON.stringify(customLLLM))

    //     // Hide the modal after saving
    //     $('#byoLlmModal').modal('hide');
    // });

    // // Initialize with the default platform from local storage or 'bedrock'
    // populateModels(llmPlatform || 'bedrock', llmModel, true);
});
