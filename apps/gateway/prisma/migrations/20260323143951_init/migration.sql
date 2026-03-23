-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "config" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_used" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connectors" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_calls" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "response" JSONB NOT NULL DEFAULT '{}',
    "status_code" INTEGER,
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "success_calls" INTEGER NOT NULL DEFAULT 0,
    "error_calls" INTEGER NOT NULL DEFAULT 0,
    "avg_latency" DOUBLE PRECISION,
    "p95_latency" DOUBLE PRECISION,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_rules" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "connector_id" TEXT,
    "tool_name" TEXT,
    "rule_type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "tool_call_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolved_by" TEXT,
    "resolved_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "tool_calls_client_id_created_at_idx" ON "tool_calls"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "tool_calls_connector_id_tool_name_idx" ON "tool_calls"("connector_id", "tool_name");

-- CreateIndex
CREATE INDEX "tool_calls_created_at_idx" ON "tool_calls"("created_at");

-- CreateIndex
CREATE INDEX "webhook_events_client_id_status_idx" ON "webhook_events"("client_id", "status");

-- CreateIndex
CREATE INDEX "webhook_events_status_next_retry_at_idx" ON "webhook_events"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "daily_metrics_client_id_date_idx" ON "daily_metrics"("client_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_client_id_connector_id_date_key" ON "daily_metrics"("client_id", "connector_id", "date");

-- CreateIndex
CREATE INDEX "execution_rules_client_id_active_idx" ON "execution_rules"("client_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "escalations_tool_call_id_key" ON "escalations"("tool_call_id");

-- CreateIndex
CREATE INDEX "escalations_client_id_status_idx" ON "escalations"("client_id", "status");

-- CreateIndex
CREATE INDEX "escalations_status_created_at_idx" ON "escalations"("status", "created_at");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_rules" ADD CONSTRAINT "execution_rules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_rules" ADD CONSTRAINT "execution_rules_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_tool_call_id_fkey" FOREIGN KEY ("tool_call_id") REFERENCES "tool_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
