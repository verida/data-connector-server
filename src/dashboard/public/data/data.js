$(document).ready(function() {
    let offset = 0;
    const apiUrl = '/api/v1/data';
    let currentSortField = '';
    let currentSortDirection = 'asc';
    let currentFilters = {};

    // Load Verida Key and Schema from local storage
    $('#veridaKey').val(localStorage.getItem('veridaKey') || '');
    $('#schema').val(localStorage.getItem('schema') || '');

    // Function to get query parameters
    function getQueryParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            limit: params.get('limit') || '10',
            offset: params.get('offset') || '0',
            sort: params.get('sort') || '',
            filter: params.get('filter') || ''
        };
    }

    // Parse query parameters and set form values
    function setInitialValues() {
        const queryParams = getQueryParams();
        $('#limit').val(queryParams.limit);
        offset = parseInt(queryParams.offset, 10);
        const [sortField, sortDirection] = queryParams.sort.split(':');
        currentSortField = sortField || '';
        currentSortDirection = sortDirection || 'asc';

        $('#sortField').val(currentSortField);
        $('#sortDirection').val(currentSortDirection);

        // Set filters
        queryParams.filter.split(',').forEach(filter => {
            const [field, value] = filter.split(':');
            if (field && value) {
                currentFilters[field] = value;
            }
        });
    }

    function fetchData() {
        const veridaKey = $('#veridaKey').val();
        const schema = $('#schema').val();
        const limit = $('#limit').val();
        const sortField = currentSortField;
        const sortDirection = currentSortDirection;
        const filterParam = Object.keys(currentFilters).map(key => `${key}:${currentFilters[key]}`).join(',');

        // Show loading message
        $('#tableBody').html('<tr><td colspan="100%" class="text-center">Loading...</td></tr>');
        $('.alert').hide(); // Hide previous error messages

        $.ajax({
            url: apiUrl,
            data: {
                key: veridaKey,
                schema: schema,
                limit: limit,
                offset: offset,
                sort: sortField ? `${sortField}:${sortDirection}` : '',
                filter: filterParam
            },
            success: function(response) {
                const results = response.results;
                const options = response.options;
                const headers = Object.keys(results[0] || {});

                // Populate table headers
                $('#tableHeaders').empty();
                headers.forEach(header => {
                    const sortIcon = (header === currentSortField) ? (currentSortDirection === 'asc' ? '▲' : '▼') : '';
                    $('#tableHeaders').append(`<th class="sortable" data-field="${header}">${header} ${sortIcon}</th>`);
                });

                // Populate table rows
                $('#tableBody').empty();
                results.forEach(row => {
                    let rowHtml = '<tr>';
                    headers.forEach(header => {
                        rowHtml += `<td>${row[header] || ''}</td>`;
                    });
                    rowHtml += '</tr>';
                    $('#tableBody').append(rowHtml);
                });

                // Populate sort field dropdown
                $('#sortField').empty();
                headers.forEach(header => {
                    $('#sortField').append(`<option value="${header}">${header}</option>`);
                });
                $('#sortField').val(currentSortField);

                // Populate filter modal fields
                $('#filterFields').empty();
                headers.forEach(header => {
                    $('#filterFields').append(`
                        <div class="form-group">
                            <label for="filter-${header}">${header}</label>
                            <input type="text" id="filter-${header}" class="form-control" data-field="${header}">
                        </div>
                    `);
                });

                // Set existing filter values
                Object.keys(currentFilters).forEach(key => {
                    $(`#filter-${key}`).val(currentFilters[key]);
                });

                // Display applied filters
                const filterInfoHtml = Object.keys(currentFilters).map(key => `<strong>${key}:</strong> ${currentFilters[key]}`).join(', ');
                $('#filterInfo').html(filterInfoHtml ? `Applied Filters: ${filterInfoHtml}` : '');

                // Show filter modal button if results are loaded
                $('#openFilters').show();

                // Handle pagination
                $('#prevButton').toggleClass('disabled', options.skip === 0);
                $('#nextButton').toggleClass('disabled', results.length < limit);
            },
            error: function(jqXHR) {
                const error = jqXHR.responseJSON ? jqXHR.responseJSON.error : 'An error occurred';
                $('.alert').text(error).show();
            }
        });
    }

    // Save Verida Key and Schema to local storage
    $('#veridaKey').on('input', function() {
        localStorage.setItem('veridaKey', $(this).val());
    });

    $('#schema').on('input', function() {
        localStorage.setItem('schema', $(this).val());
    });

    // Handle column header click for sorting
    $('#tableHeaders').on('click', '.sortable', function() {
        const field = $(this).data('field');
        if (field === currentSortField) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortField = field;
            currentSortDirection = 'asc';
        }
        $('#sortField').val(currentSortField);
        $('#sortDirection').val(currentSortDirection);
        fetchData();
    });

    // Update sort field and direction on dropdown change
    $('#sortField').change(function() {
        const field = $(this).val();
        if (field === currentSortField) {
            currentSortDirection = $('#sortDirection').val();
        } else {
            currentSortField = field;
            currentSortDirection = 'asc';
        }
        $('#sortDirection').val(currentSortDirection);
        fetchData();
    });

    $('#sortDirection').change(function() {
        currentSortDirection = $(this).val();
        fetchData();
    });

    // Apply filters from modal
    $('#applyFilters').click(function() {
        const filters = {};
        $('#filterFields input').each(function() {
            const field = $(this).data('field');
            const value = $(this).val();
            if (value) {
                filters[field] = value;
            }
        });
        currentFilters = filters;
        fetchData();
        $('#filterModal').modal('hide');
    });

    $('#searchButton').click(fetchData);

    $('#prevButton').click(function(e) {
        e.preventDefault();
        if (offset > 0) {
            offset -= parseInt($('#limit').val());
            fetchData();
        }
    });

    $('#nextButton').click(function(e) {
        e.preventDefault();
        offset += parseInt($('#limit').val());
        fetchData();
    });

    // Example of listing schemas
    $('#schemaModal').on('show.bs.modal', function() {
        const schemas = {
            "Sync Position": "https://vault.schemas.verida.io/data-connections/sync-position/v0.1.0/schema.json",
            "Sync Activity Log": "https://vault.schemas.verida.io/data-connections/activity-log/v0.1.0/schema.json",
            "Connections": "https://vault.schemas.verida.io/data-connections/connection/v0.2.0/schema.json",
            "Social Following": "https://common.schemas.verida.io/social/following/v0.1.0/schema.json",
            "Social Post": "https://common.schemas.verida.io/social/post/v0.1.0/schema.json",
            "Favourites": "https://common.schemas.verida.io/favourite/v0.1.0/schema.json",
            "Email": "https://common.schemas.verida.io/social/email/v0.1.0/schema.json",
            "Chat Group": "https://common.schemas.verida.io/social/chat/group/v0.1.0/schema.json",
            "Chat Message": "https://common.schemas.verida.io/social/chat/message/v0.1.0/schema.json"
        };

        // Clear previous list
        $('#schemaList').empty();

        // Append each schema as a list item
        $.each(schemas, function(name, url) {
            $('#schemaList').append(`<li><a href="#" data-url="${url}">${name}</a></li>`);
        });
    });

    // Set schema URL in input field on link click
    $('#schemaList').on('click', 'a', function(e) {
        e.preventDefault();
        const url = $(this).data('url');
        $('#schema').val(url);
        $('#schemaModal').modal('hide');
    });

    // Show filter modal on button click
    $('#openFilters').click(function() {
        $('#filterModal').modal('show');
    });

    // Hide the filter button initially
    $('#openFilters').hide();

    // Set initial values from query parameters
    setInitialValues();
    fetchData();
});
