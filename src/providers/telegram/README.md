

# Known issues

1. Telegram auth file is saved every batch processing (increases disk size unecessarily)
2. Chat group is re-saved every batch processing (increases disk size unecessarily)
3. The deletion of a chat message isn't sync'd, Telegram doesn't provide that information through the API, only through it's event listener
4. Need to better support all message types https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1_message_content.html