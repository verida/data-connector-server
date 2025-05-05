function setError(message) {
    $("#errorContainer").show();
    $("#errorMessage").text(message);
    setTimeout(() => {
        $("#errorContainer").hide();
    }, 5000);
}

function disableButton() {
    $('#submitButton').prop('disabled', true);
}

function enableButton() {
    $('#submitButton').prop('disabled', false);
}

function submitApiKey() {
    disableButton();
    const apiKey = $('.form-control').val().trim();
    
    if (!apiKey) {
        setError("API Key is required.");
        enableButton();
        return;
    }

    $.post('/api/rest/v1/fireflies/apiKeySubmit', { apiKey: apiKey }, null, 'json')
        .done((response) => {             
            window.location.href = response.redirect;           
        })
        .fail(() => {
            setError("Failed to connect to Fireflies API. Please try again later.");
            enableButton();
        });
}

$(document).ready(function() {
    $("#errorContainer").hide();    
});
