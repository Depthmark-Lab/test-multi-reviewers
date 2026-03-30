{{/*
Expand the name of the chart.
*/}}
{{- define "check-reviewer-no-commit.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fullname — release + chart name, truncated to 63 chars.
*/}}
{{- define "check-reviewer-no-commit.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "check-reviewer-no-commit.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "check-reviewer-no-commit.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "check-reviewer-no-commit.selectorLabels" -}}
app.kubernetes.io/name: {{ include "check-reviewer-no-commit.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Secret name — use existing or generated.
*/}}
{{- define "check-reviewer-no-commit.secretName" -}}
{{- if .Values.app.existingSecret }}
{{- .Values.app.existingSecret }}
{{- else }}
{{- include "check-reviewer-no-commit.fullname" . }}
{{- end }}
{{- end }}
