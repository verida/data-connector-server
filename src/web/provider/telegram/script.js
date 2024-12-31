// const qrCodeLink = '';
let requestId = ''

// function generateQRCode(link) {
//     const qrCodeContainer = $('#qr-code');

//     // Clear previous QR code
//     qrCodeContainer.empty();

//     // Generate new QR code
//     QRCode.toCanvas(link, function (error, canvas) {
//         if (error) {
//             console.error(error);
//         } else {
//             qrCodeContainer.append(canvas);
//         }
//     });
// }

function createInputBox(type, placeholder, buttonText, submitFunction) {
    const inputContainer = $('#input-container');
    inputContainer.empty();

    const inputBox = $('<input>')
        .attr('type', type)
        .attr('placeholder', placeholder)
        .addClass('form-control my-2');

    const submitButton = $('<button>')
        .text(buttonText)
        .attr('id', 'submitButton')
        .addClass('btn btn-primary my-2')
        .on('click', submitFunction);

    inputContainer.append(inputBox).append(submitButton);
}

function setError(message) {
    $("#errorContainer").show()
    $("#errorMessage").text(message)
    setTimeout(() => {
        $("#errorContainer").hide()
    }, 5000)
}

function disableButton() {
    $('#submitButton').prop('disabled', true)
}

function enableButton() {
    $('#submitButton').prop('disabled', false)
}

function submitAuthCode() {
    disableButton()
    const authCode = $('.form-control').val();
    $.post('/api/rest/v1/telegram/loginSubmit', { type: 'authcode', code: authCode, requestId }, null, 'json').fail((jqXHR, textStatus, error) => {
        setError(`Invalid auth code`)
        enableButton()
    })
}

function submitPhoneNumber() {
    disableButton()
    const phoneNumber = $('.form-control').val();
    $.post('/api/rest/v1/telegram/loginSubmit', { type: 'phone', phone: phoneNumber, requestId }, null, 'json').fail((jqXHR, textStatus, error) => {
        setError(`Invalid phone number`)
        enableButton()
    })
}

function submitPassword() {
    disableButton()
    const password = $('.form-control').val();
    $.post('/api/rest/v1/telegram/loginSubmit', { type: 'password', password, requestId }, null, 'json').fail((jqXHR, textStatus, error) => {
        setError(`Invalid password`)
        enableButton()
    })
}

$(document).ready(function() {
    // generateQRCode(qrCodeLink);
    $("#errorContainer").hide()

    const eventSource = new EventSource('/api/rest/v1/telegram/login');

    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        requestId = data.requestId

        if (data.type === 'qrcode') {
            generateQRCode(data.link);
        } else if (data.type === 'authcode') {
            createInputBox('text', 'Enter authentication code', 'Submit Code', submitAuthCode);
        } else if (data.type === 'phone') {
            createInputBox('phone', 'Enter phone number (include country code)', 'Submit', submitPhoneNumber);
        } else if (data.type === 'password') {
            createInputBox('password', 'Enter password', 'Submit', submitPassword);
        } else if (data.type === 'complete') {
            window.location.href = data.redirect
        }

        enableButton()
    };
});
