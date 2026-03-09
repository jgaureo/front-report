# BigQuery Database Schemas

Generated for project: possible-ace-317306

This file contains the schema for tables in the `front` and `email_quote_request` datasets.

## Dataset: `front`

### Table: `account`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| name | STRING | - |
| logo_url | STRING | - |
| description | STRING | - |
| domains | STRING | - |
| external_id | STRING | - |
| created_at | TIMESTAMP | - |
| updated_at | TIMESTAMP | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |
| custom_import_rep | STRING | - |
| custom_export_global_rep | STRING | - |
| custom_vip | BOOLEAN | - |
| custom_rep_specific | BOOLEAN | - |
| custom_domestic_rep | STRING | - |

### Table: `attachment`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| message_id | STRING | - |
| index | INTEGER | - |
| filename | STRING | - |
| url | STRING | - |
| content_type | STRING | - |
| size | INTEGER | - |
| is_inline | BOOLEAN | - |
| cid | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `channel`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| address | STRING | - |
| type | STRING | - |
| send_as | STRING | - |
| settings | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `comment`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| conversation_id | STRING | - |
| author_id | STRING | - |
| body | STRING | - |
| posted_at | TIMESTAMP | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `comment_mention`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| comment_id | STRING | - |
| teammate_id | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `contact`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| name | STRING | - |
| description | STRING | - |
| avatar_url | STRING | - |
| is_spammer | BOOLEAN | - |
| account_id | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |
| custom_rep_specific | BOOLEAN | - |
| custom_import_rep | STRING | - |
| custom_export_global_rep | STRING | - |
| custom_domestic_rep | STRING | - |

### Table: `contact_handle`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| contact_id | STRING | - |
| index | INTEGER | - |
| handle | STRING | - |
| source | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `contact_list`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| contact_id | STRING | - |
| list_id | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `conversation`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| teammate_id | STRING | - |
| last_message_id | STRING | - |
| subject | STRING | - |
| status | STRING | - |
| status_category | STRING | - |
| created_at | TIMESTAMP | - |
| recipient_handle | STRING | - |
| recipient_role | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |
| status_id | STRING | - |

### Table: `conversation_inbox`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| conversation_id | STRING | - |
| inbox_id | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `conversation_link`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| conversation_id | STRING | - |
| link_id | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `conversation_status_history`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| conversation_id | STRING | - |
| status | STRING | - |
| updated_at | TIMESTAMP | - |
| target_teammate_id | STRING | - |
| source_teammate_id | STRING | - |
| source_rule_id | STRING | - |
| source_type | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `conversation_tag`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| conversation_id | STRING | - |
| tag_id | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `conversation_tag_history`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| conversation_id | STRING | - |
| tag_id | STRING | - |
| updated_at | TIMESTAMP | - |
| source_teammate_id | STRING | - |
| source_rule_id | STRING | - |
| source_type | STRING | - |
| event_type | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `follower`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| conversation_id | STRING | - |
| teammate_id | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `inbox`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| address | STRING | - |
| type | STRING | - |
| name | STRING | - |
| send_as | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `inbox_channel`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| inbox_id | STRING | - |
| channel_id | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `inbox_teammate`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| inbox_id | STRING | - |
| teammate_id | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `link`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| name | STRING | - |
| type | STRING | - |
| external_url | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |
| custom_qrn | STRING | - |
| custom_stage | STRING | - |
| custom_origin | STRING | - |

### Table: `list`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| name | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `message`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| conversation_id | STRING | - |
| author_id | STRING | - |
| type | STRING | - |
| is_inbound | BOOLEAN | - |
| created_at | TIMESTAMP | - |
| blurb | STRING | - |
| body | STRING | - |
| text | STRING | - |
| intercom_url | STRING | - |
| duration | INTEGER | - |
| have_been_answered | BOOLEAN | - |
| twitter_url | STRING | - |
| is_retweet | BOOLEAN | - |
| have_been_retweeted | BOOLEAN | - |
| have_been_favorited | BOOLEAN | - |
| thread_ref | STRING | - |
| headers | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `message_recipient`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| message_id | STRING | - |
| index | INTEGER | - |
| handle | STRING | - |
| role | STRING | - |
| contact_id | STRING | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `rule`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| name | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `rule_action`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| rule_id | STRING | - |
| index | INTEGER | - |
| action | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `tag`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| name | STRING | - |
| highlight | STRING | - |
| description | STRING | - |
| is_private | BOOLEAN | - |
| is_visible_in_conversation_lists | BOOLEAN | - |
| created_at | TIMESTAMP | - |
| updated_at | TIMESTAMP | - |
| parent_tag_id | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `team`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| name | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `team_inbox`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| team_id | STRING | - |
| inbox_id | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `team_teammate`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| team_id | STRING | - |
| teammate_id | STRING | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `teammate`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| email | STRING | - |
| username | STRING | - |
| first_name | STRING | - |
| last_name | STRING | - |
| is_admin | BOOLEAN | - |
| is_available | BOOLEAN | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

### Table: `ticket_status`

| Column Name | Data Type | Description |
|-------------|-----------|-------------|
| id | STRING | - |
| name | STRING | - |
| category | STRING | - |
| description | STRING | - |
| created_at | TIMESTAMP | - |
| updated_at | TIMESTAMP | - |
| _fivetran_deleted | BOOLEAN | - |
| _fivetran_synced | TIMESTAMP | - |

