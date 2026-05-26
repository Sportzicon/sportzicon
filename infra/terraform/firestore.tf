# Firestore database — native mode. Single-region for cost; switch to multi-region
# (nam5 / eur3) once the platform has paying customers.
resource "google_firestore_database" "default" {
  project                     = var.project_id
  name                        = "(default)"
  location_id                 = var.region
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"
  depends_on                  = [google_project_service.apis]
}

# Composite indexes — required for filtered list queries (Firestore enforces these).
# Each block here corresponds to a real .where(...).orderBy(...) usage in the API.

resource "google_firestore_index" "opportunities_status_created" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "opportunities"
  query_scope = "COLLECTION"
  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "opportunities_sport_status_created" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "opportunities"
  query_scope = "COLLECTION"
  fields {
    field_path = "status"
    order      = "ASCENDING"
  }
  fields {
    field_path = "sport"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "applications_applicant_applied" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "applications"
  query_scope = "COLLECTION"
  fields {
    field_path = "applicant_user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "applied_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "applications_opp_applied" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "applications"
  query_scope = "COLLECTION"
  fields {
    field_path = "opportunity_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "applied_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "notifications_user_created" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "notifications"
  query_scope = "COLLECTION"
  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "notifications_user_read_created" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "notifications"
  query_scope = "COLLECTION"
  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "read"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "conversations_participants_updated" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "conversations"
  query_scope = "COLLECTION"
  fields {
    field_path   = "participant_ids"
    array_config = "CONTAINS"
  }
  fields {
    field_path = "updated_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "messages_conv_created" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "messages"
  query_scope = "COLLECTION"
  fields {
    field_path = "conversation_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "posts_author_created" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "posts"
  query_scope = "COLLECTION"
  fields {
    field_path = "author_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "comments_parent" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "comments"
  query_scope = "COLLECTION"
  fields {
    field_path = "parent_type"
    order      = "ASCENDING"
  }
  fields {
    field_path = "parent_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}

resource "google_firestore_index" "audit_logs_created" {
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "audit_logs"
  query_scope = "COLLECTION"
  fields {
    field_path = "created_at"
    order      = "DESCENDING"
  }
  fields {
    field_path = "__name__"
    order      = "DESCENDING"
  }
}
