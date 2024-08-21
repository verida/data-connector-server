const commonParams = {
    "provider": {
        "type": "string",
        "required": true,
        "documentation": "The name of the provider to connect to, ie: `google`",
        "default": "google"
    },
    "providerId": {
        "type": "string",
        "required": false,
        "documentation": "The unique provider ID to use. For example, if you have two Google accounts connected, you can specify which account. The provider ID is listed in the /dashboard/connections table.",
    },
}

// Global JSON object with endpoint configurations
const apiEndpoints = {
    "/db/get": {
        "method": "GET",
        "path": "/api/v1/db/get",
        "documentation": "Retrieves a list of available providers."
    },
    "/db/query": {
        "method": "POST",
        "path": "/api/v1/db/query",
        "documentation": "Query a database",
        "params": {
            "query": {
                "type": "string",
                "required": false,
                "documentation": "A <a href=\"https://pouchdb.com/api.html#query_index\">pouchdb style filter</a> ie: {name: \"John\"}"
            },
            "options": {
                "type": "string",
                "required": false,
                "documentation": "Additional options provided as JSON. Available options are; sort, limit, skip as per the <a href=\"https://pouchdb.com/api.html#query_index\">pouchdb documentation</a>.",
                "default": JSON.stringify({
                    sort: [{
                        _id: "desc"
                    }],
                    limit: 20
                })
            }
        }
    },
    "/providers": {
        "method": "GET",
        "path": "/api/v1/providers",
        "documentation": "Retrieves a list of available providers."
    },
    "/sync": {
        "method": "GET",
        "path": "/api/v1/sync",
        "documentation": "Start syncing data for a given provider",
        "params": {
            "provider": commonParams.provider,
            "providerId": commonParams.providerId,
            "force": {
                "type": "boolean",
                "required": false,
                "documentation": "Force the sync to occur, ignoring the current status of the connection."
            }
        }
    },
    "/syncStatus": {
        "method": "GET",
        "path": "/api/v1/syncStatus",
        "params": {
            "provider": commonParams.provider,
            "providerId": commonParams.providerId,
        },
        "documentation": "Get the status of the current sync connection for a provider."
    }
};

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

    // Update endpoint options when selection changes
    $('#endpointSelect').change(function() {
        updateEndpointOptions($(this).val());
    });

    // Initial update of endpoint options
    updateEndpointOptions($('#endpointSelect').val());

    // Run endpoint button click handler
    $('#runEndpoint').click(function() {
        runEndpoint();
    });

    // Update code examples when any input changes
    $(document).on('input', 'input, select', function() {
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
});

function updateEndpointOptions(endpoint) {
    const endpointConfig = apiEndpoints[endpoint];
    let optionsHtml = '';

    // Add endpoint documentation
    $('#endpointDocumentation').html(`<p><strong>Documentation:</strong> ${endpointConfig.documentation}</p>`);

    if (endpointConfig.params) {
        for (let param in endpointConfig.params) {
            const paramConfig = endpointConfig.params[param];
            optionsHtml += `
                <div class="form-group">
                    <label for="${param}">${param}${paramConfig.required ? ' *' : ''}:</label>
                    <input type="${paramConfig.type}" class="form-control" id="${param}" name="${param}" 
                           value="${paramConfig.default || ''}" 
                           ${paramConfig.required ? 'required' : ''}>
                    <small class="form-text text-muted">${paramConfig.documentation}</small>
                </div>
            `;
        }
    }

    $('#endpointOptions').html(optionsHtml);
    updateCodeExamples();
}

function updateCodeExamples() {
    const endpoint = $('#endpointSelect').val();
    const privateKey = '<privateKey>'// $('#privateKey').val();
    const baseUrl = $('#baseUrl').val();
    const endpointConfig = apiEndpoints[endpoint];
    const url = `${baseUrl}${endpointConfig.path}`;
    const method = endpointConfig.method;
    const data = {};

    $('#endpointOptions input').each(function() {
        const paramName = $(this).attr('name');
        const paramValue = $(this).val() || (endpointConfig.params && endpointConfig.params[paramName] ? endpointConfig.params[paramName].default : '');
        if (paramValue) {
            data[paramName] = paramValue;
        }
    });

    // Update cURL example
    let curlCommand = `curl -X ${method} `;
    if (privateKey) {
        curlCommand += `-H "Authorization: Bearer ${privateKey}" `;
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
        ${privateKey ? `'Authorization': 'Bearer ${privateKey}',` : ''}
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
    ${privateKey ? `'Authorization': 'Bearer ${privateKey}'` : ''}
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
    "authorization: Bearer ${privateKey}"` : ''}
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
    "Authorization": "Bearer ${privateKey}"` : ''}
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
    const url = `${baseUrl}${endpointConfig.path}`;
    const method = endpointConfig.method;
    const data = {};

    $('#endpointOptions input').each(function() {
        const paramName = $(this).attr('name');
        const paramValue = $(this).val() || (endpointConfig.params && endpointConfig.params[paramName] ? endpointConfig.params[paramName].default : '');
        if (paramValue) {
            data[paramName] = paramValue;
        }
    });

    data.key = privateKey

    $.ajax({
        url: url,
        method: method,
        data: method === 'GET' ? data : JSON.stringify(data),
        contentType: 'application/json',
        /*headers: {
            'Authorization': `Bearer ${privateKey}`
        },*/
        success: function(response) {
            $('#result').text(JSON.stringify(response, null, 2));
        },
        error: function(xhr, status, error) {
            $('#result').text(`Error: ${error}\n\nResponse: ${xhr.responseText}`);
        }
    });
}

// Check private key on input change
$('#privateKey').on('input', function() {
    if (!$(this).val()) {
        $('#settingsPanel').show();
    }
});