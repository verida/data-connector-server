
function saveState() {
    const state = {
        selectedEndpoint: $('#endpointSelect').val(),
        urlVariables: {},
        queryParams: {},
        selectedLanguage: $('#codeExampleTabs .nav-link.active').attr('id').replace('-tab', '')
    };

    // Save URL variables
    $('.url-variable').each(function() {
        state.urlVariables[$(this).attr('id')] = $(this).val();
    });

    // Save query parameters
    $('#endpointOptions input, #endpointOptions textarea').each(function() {
        state.queryParams[$(this).attr('name')] = $(this).val();
    });

    localStorage.setItem('apiTestState', JSON.stringify(state));
}

function loadState() {
    const savedState = localStorage.getItem('apiTestState');
    if (savedState) {
        const state = JSON.parse(savedState);

        // Set selected endpoint
        $('#endpointSelect').val(state.selectedEndpoint).change();

        // Set URL variables
        for (let id in state.urlVariables) {
            $(`#${id}`).val(state.urlVariables[id]);
        }

        // Set query parameters
        for (let name in state.queryParams) {
            $(`#endpointOptions [name="${name}"]`).val(state.queryParams[name]);
        }

        // Set selected language
        $(`.code-example`).removeClass('active');
        $(`#codeExampleTabs a[href="#${state.selectedLanguage}"]`).tab('show');
    }
}

$(document).ready(function() {
    // Load the private key from local storage
    const savedVeridaKey = localStorage.getItem('veridaKey');
    $('#privateKey').val(savedVeridaKey);
    
    $('#privateKey').on('change', function() {
        const veridaKey = $('#privateKey').val().trim();
        // Save the private key in local storage
        localStorage.setItem('veridaKey', veridaKey);
    })

    // Populate endpoint dropdown
    for (let endpoint in apiEndpoints) {
        $('#endpointSelect').append($('<option>', {
            value: endpoint,
            text: endpoint
        }));
    }

    // Run endpoint button click handler
    $('#runEndpoint').click(function() {
        runEndpoint();
    });

    // Update code examples when any input changes
    $(document).on('input', 'input, select, textarea', function() {
        updateCodeExamples();
    });

    // Settings toggle button
    $('#settingsToggle').click(function() {
        $('#settingsPanel').toggle();
    });

    // Show settings panel if private key is empty
    if (!$('#privateKey').val()) {
        $('#settingsPanel').show();
    }

    // Add event listeners for code example toggles
    $('#codeExampleTabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        console.log('Tab clicked:', $(e.target).attr('href'));
        saveState();
    });

    $('#showPrivateKey').change(function() {
        updateCodeExamples();
    });

    // Load saved state
    loadState();

    // Save state when inputs change
    $(document).on('input', 'input, select, textarea', function() {
        saveState();
        updateCodeExamples();
    });

    // Save state when endpoint selection changes
    $('#endpointSelect').change(function() {
        updateEndpointOptions($(this).val());
        saveState();
    });

    // Save state when language selection changes
    $(document).on('click', '.code-example-toggle', function(e) {
        e.preventDefault();
        console.log('toggle');
        $('.code-example').removeClass('active');
        $($(this).attr('href')).addClass('active');
        saveState();
    });

    // Initial update of endpoint options
    updateEndpointOptions($('#endpointSelect').val());
});

function updateEndpointOptions(endpoint) {
    const endpointConfig = apiEndpoints[endpoint];
    let urlVariablesHtml = '';
    let optionsHtml = '';

    // Add endpoint documentation
    $('#endpointDocumentation').html(`
        <div class="alert alert-secondary endpoint-docs" role="alert">
            <div id="docContent"></div>
        </div>
    `);

    $('#docContent').html(marked.parse(endpointConfig.documentation));

    // Handle URL variables
    if (endpointConfig.urlVariables) {
        // urlVariablesHtml += '<h4>URL Variables:</h4>';
        for (let variable in endpointConfig.urlVariables) {
            const variableConfig = endpointConfig.urlVariables[variable];
            urlVariablesHtml += `
                <div class="param-row">
                    <div class="param-input">
                        <label for="${variable}">${variable}${variableConfig.required ? ' *' : ''}:</label>
                        <input type="${variableConfig.type}" class="form-control url-variable" id="${variable}" name="${variable}" 
                               ${variableConfig.required ? 'required' : ''}>
                    </div>
                    <div class="param-docs">
                        <small class="form-text text-muted">${marked.parse(variableConfig.documentation)}</small>
                    </div>
                </div>
            `;
        }
    }

    // Handle regular parameters
    if (endpointConfig.params) {
        for (let param in endpointConfig.params) {
            const paramConfig = endpointConfig.params[param];
            optionsHtml += `
                <div class="param-row">
                    <div class="param-input">
                        <label for="${param}">${param}${paramConfig.required ? ' *' : ''}:</label>
                        ${paramConfig.type === 'object' ?
                            `<textarea class="form-control" id="${param}" name="${param}" rows="5"
                                ${paramConfig.required ? 'required' : ''}>${paramConfig.default || ''}</textarea>` :
                            `<input type="${paramConfig.type}" class="form-control" id="${param}" name="${param}" 
                                value="${paramConfig.default || ''}" 
                                ${paramConfig.required ? 'required' : ''}>`
                        }
                    </div>
                    <div class="param-docs">
                        <small class="form-text text-muted">${marked.parse(paramConfig.documentation)}</small>
                    </div>
                </div>
            `;
        }
    }

    $('#urlVariables').html(urlVariablesHtml);
    $('#endpointOptions').html(optionsHtml);

    // Initialize JSON formatting for the 'options' parameter
    if (endpointConfig.params && endpointConfig.params.options) {
        const optionsTextArea = $('#options');
        optionsTextArea.val(JSON.stringify(JSON.parse(optionsTextArea.val()), null, 2));
    }

    updateCodeExamples();
}

function updateCodeExamples() {
    const endpoint = $('#endpointSelect').val();
    const privateKey = $('#showPrivateKey').is(':checked') ? $('#privateKey').val() : '<privateKey>';
    const baseUrl = $('#baseUrl').val();
    const endpointConfig = apiEndpoints[endpoint];
    let url = `${baseUrl}${endpointConfig.path}`;
    const method = endpointConfig.method;
    const data = {};

    // Handle URL variables
    $('.url-variable').each(function() {
        const variableName = $(this).attr('name');
        const variableValue = $(this).val() || `{${variableName}}`;
        url = url.replace(`{${variableName}}`, variableValue);
    });

    $('#endpointOptions input, #endpointOptions textarea').each(function() {
        const paramName = $(this).attr('name');
        let paramValue = $(this).val() || (endpointConfig.params && endpointConfig.params[paramName] ? endpointConfig.params[paramName].default : '');
        
        if (paramName === 'options') {
            try {
                paramValue = JSON.parse(paramValue);
            } catch (e) {
                console.error('Invalid JSON in options field');
            }
        }
        
        if (paramValue) {
            data[paramName] = paramValue;
        }
    });

    // Update cURL example
    let curlCommand = `curl -X ${method} `;
    if (privateKey) {
        curlCommand += `-H "key: ${privateKey}" `;
    }
    curlCommand += `"${url}`;
    if (method === 'GET' && Object.keys(data).length > 0) {
        curlCommand += `?${$.param(data)}"`;
    } else if (method === 'POST') {
        curlCommand += `" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(data)}'`;
    } else {
        curlCommand += `"`;
    }
    $('#curlCommand').text(curlCommand);

    // Update Node.js example
    let nodejsCode = `const axios = require('axios');

async function makeRequest() {
  try {
    const response = await axios({
      method: '${method}',
      url: '${url}',
      ${method === 'GET' ? `params: ${JSON.stringify(data)}` : `data: ${JSON.stringify(data)}`},
      headers: {
        ${privateKey ? `'key': '${privateKey}',` : ''}
        'Content-Type': 'application/json'
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}

makeRequest();`;
    $('#nodejsCode').text(nodejsCode);

    // Update jQuery example
    let jqueryCode = `$.ajax({
  url: '${url}',
  method: '${method}',
  ${method === 'GET' ? `data: ${JSON.stringify(data)},` : `data: JSON.stringify(${JSON.stringify(data)}),`}
  contentType: 'application/json',
  headers: {
    ${privateKey ? `'key': '${privateKey}'` : ''}
  },
  success: function(response) {
    console.log(response);
  },
  error: function(xhr, status, error) {
    console.error(error);
  }
});`;
    $('#jqueryCode').text(jqueryCode);

    // Update PHP example
    let phpCode = `<?php
$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => "${url}${method === 'GET' ? '?' + $.param(data) : ''}",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => "",
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => "${method}",
  ${method === 'POST' ? `CURLOPT_POSTFIELDS => '${JSON.stringify(data)}',` : ''}
  CURLOPT_HTTPHEADER => array(
    "content-type: application/json"${privateKey ? `,
    "key: ${privateKey}"` : ''}
  ),
));

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
  echo "cURL Error #:" . $err;
} else {
  echo $response;
}`;
    $('#phpCode').text(phpCode);

    // Update Python example
    let pythonCode = `import requests

url = "${url}"
headers = {
    "Content-Type": "application/json"${privateKey ? `,
    "key": "${privateKey}"` : ''}
}
${method === 'GET' ? `params = ${JSON.stringify(data)}` : `data = ${JSON.stringify(data)}`}

response = requests.${method.toLowerCase()}(url, ${method === 'GET' ? 'params=params' : 'json=data'}, headers=headers)

print(response.json())`;
    $('#pythonCode').text(pythonCode);
}

function runEndpoint() {
    const endpoint = $('#endpointSelect').val();
    const privateKey = $('#privateKey').val();
    const baseUrl = $('#baseUrl').val();
    const endpointConfig = apiEndpoints[endpoint];
    let url = `${baseUrl}${endpointConfig.path}`;
    const method = endpointConfig.method;
    const data = {};

    // Handle URL variables
    if (endpointConfig.urlVariables) {
        for (let variable in endpointConfig.urlVariables) {
            let inputValue = $(`#${variable}`).val();
            if (inputValue) {
                if (endpointConfig.urlVariables[variable].preProcessing) {
                    inputValue = endpointConfig.urlVariables[variable].preProcessing(inputValue)
                }

                url = url.replace(`{${variable}}`, encodeURIComponent(inputValue));
            }
        }
    }

    // Handle other parameters
    $('#endpointOptions input, #endpointOptions textarea').each(function() {
        const paramName = $(this).attr('name');
        let paramValue = $(this).val() || (endpointConfig.params && endpointConfig.params[paramName] ? endpointConfig.params[paramName].default : '');
        
        if ($(this).is("textarea")) {
            try {
                paramValue = paramValue ? JSON.parse(paramValue) : {}
            } catch (e) {
                console.error(`Invalid JSON in ${paramName} field`);
            }
        }
        
        if (paramValue) {
            data[paramName] = paramValue;
        }
    });

    const headers = {
        key: privateKey
    }

    $('#result').text('Request sent... waiting...')

    $.ajax({
        url: url,
        method: method,
        data: method === 'GET' ? data : JSON.stringify(data),
        headers,
        contentType: 'application/json',
        success: function(response) {
            const $customElement = $(`<pretty-json expand="2">${JSON.stringify(response)}</pretty-json>`);
            $('#result').empty()
            $('#result').append($customElement)
        },
        error: function(xhr, status, error) {
            $('#result').text(`Error: ${error}\n\nResponse: ${xhr.responseText}`);
        }
    });
}