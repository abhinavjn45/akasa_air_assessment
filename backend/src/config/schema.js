export const managedTables = [
  'lt_schema_migrations',
  'roles',
  'users',
  'lt_seed_accounts',
  'refresh_sessions',
  'leave_categories',
  'leave_entitlements',
  'leave_requests',
  'approval_actions',
  'leave_attachments',
  'information_responses',
  'audit_events',
];

export const tableStatements = [
  `CREATE TABLE IF NOT EXISTS roles (
    code VARCHAR(16) PRIMARY KEY,
    label VARCHAR(32) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_code VARCHAR(16) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_users_role FOREIGN KEY (role_code) REFERENCES roles(code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS lt_seed_accounts (
    role_code VARCHAR(16) PRIMARY KEY,
    user_id CHAR(36) NULL UNIQUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_seed_role FOREIGN KEY (role_code) REFERENCES roles(code),
    CONSTRAINT fk_seed_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS refresh_sessions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    family_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    remember_me BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at DATETIME(3) NOT NULL,
    revoked_at DATETIME(3) NULL,
    replaced_by_id CHAR(36) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_refresh_user (user_id, revoked_at),
    INDEX idx_refresh_family (family_id),
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS leave_categories (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    default_annual_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS leave_entitlements (
    user_id CHAR(36) NOT NULL,
    category_code VARCHAR(32) NOT NULL,
    leave_year SMALLINT UNSIGNED NOT NULL,
    annual_days SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, category_code, leave_year),
    CONSTRAINT fk_entitlement_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_entitlement_category FOREIGN KEY (category_code) REFERENCES leave_categories(code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS leave_requests (
    id CHAR(36) PRIMARY KEY,
    employee_user_id CHAR(36) NOT NULL,
    employee_name VARCHAR(120) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('PENDING_MANAGER','NEEDS_INFORMATION','PENDING_HOD','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING_MANAGER',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_leave_employee (employee_user_id, created_at),
    INDEX idx_leave_status (status, created_at),
    CONSTRAINT fk_leave_employee FOREIGN KEY (employee_user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS approval_actions (
    id CHAR(36) PRIMARY KEY,
    leave_request_id CHAR(36) NOT NULL,
    actor_user_id CHAR(36) NOT NULL,
    stage ENUM('MANAGER','HOD') NOT NULL,
    decision ENUM('APPROVED','REJECTED','INFO_REQUESTED') NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_approval_request (leave_request_id, created_at),
    CONSTRAINT fk_approval_leave FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id),
    CONSTRAINT fk_approval_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS leave_attachments (
    id CHAR(36) PRIMARY KEY,
    leave_request_id CHAR(36) NOT NULL,
    uploader_user_id CHAR(36) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    media_type VARCHAR(100) NOT NULL,
    byte_size INT UNSIGNED NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_attachment_request (leave_request_id),
    CONSTRAINT fk_attachment_leave FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id),
    CONSTRAINT fk_attachment_user FOREIGN KEY (uploader_user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS information_responses (
    id CHAR(36) PRIMARY KEY,
    leave_request_id CHAR(36) NOT NULL,
    author_user_id CHAR(36) NOT NULL,
    response TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_information_request (leave_request_id, created_at),
    CONSTRAINT fk_information_leave FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id),
    CONSTRAINT fk_information_user FOREIGN KEY (author_user_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id CHAR(36) PRIMARY KEY,
    actor_user_id CHAR(36) NULL,
    leave_request_id CHAR(36) NULL,
    action VARCHAR(80) NOT NULL,
    request_id CHAR(36) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_audit_actor (actor_user_id, created_at),
    INDEX idx_audit_leave (leave_request_id, created_at),
    CONSTRAINT fk_audit_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_leave FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];
