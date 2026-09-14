# Модерация EINEIRO: внешний запуск и аварийный режим

## Что подключено

Контур работает по схеме «алгоритмы → AI при смысловой неоднозначности → независимый второй AI → человек только при исключении».

Алгоритмически безопасные карточки проходят без расходов на AI. Жёсткие нарушения отклоняются алгоритмами. AI не может отменить жёсткое правило.

## Переменные окружения

Минимальный набор для внешнего AI:

```env
EINEIRO_MODERATION_AI_API_KEY=replace-with-secret
AI_MODERATION_ENABLED=true
```

Дополнительные настройки:

```env
EINEIRO_MODERATION_AI_BASE_URL=https://api.openai.com/v1
EINEIRO_MODERATION_AI_MODEL=gpt-5-mini
EINEIRO_MODERATION_AI_TIMEOUT_MS=30000
EINEIRO_AI_REGION=
MODERATION_AI_CONFIDENCE_THRESHOLD=0.78
MODERATION_HIGH_RISK_THRESHOLD=70
SECOND_AI_REVIEW_ENABLED=true
HUMAN_EXCEPTION_QUEUE_ENABLED=true
MODERATION_APPEALS_ENABLED=true
POST_PUBLICATION_MONITORING_ENABLED=true
EINEIRO_MODERATION_EVIDENCE_KEY=generate-a-separate-32-byte-secret
EINEIRO_MODERATION_EVIDENCE_DIR=./data/moderation-evidence
EINEIRO_MODERATION_EVIDENCE_MAX_BYTES=10000000
EINEIRO_MODERATION_EVIDENCE_RETENTION_DAYS=365
MODERATION_KILL_SWITCH=false
```

Ключ не хранится в Git и не должен попадать во frontend. Провайдер должен поддерживать OpenAI-совместимый endpoint `POST /chat/completions` и строгий JSON Schema response format.

Если задан `OPENAI_API_KEY`, он используется как резервное имя переменной. Явное `EINEIRO_MODERATION_AI_API_KEY` имеет приоритет.

## Запуск

```bash
npm install
npm run check
npm run build
npm run dev
```

После запуска:

1. Создать алгоритмический кейс: `POST /api/v1/moderation/cases`.
2. Если решение `AI_REVIEW_REQUIRED`, запустить AI: `POST /api/v1/moderation/cases/{caseId}/ai-review`.
3. Если получено `SECOND_AI_REVIEW`, повторить тот же запрос. Второй запрос формируется независимо.
4. Исключения владельца: `GET /api/v1/moderation/human-exceptions`.
5. Решение владельца: `POST /api/v1/moderation/human-exceptions/{id}/resolve`.
6. Апелляция с новой уликой: `POST /api/v1/moderation/cases/{caseId}/appeals`.
7. Сигнал постконтроля: `POST /api/v1/moderation/post-publication-signals`.
8. Массовый инцидент с ограниченным selector: `POST /api/v1/moderation/incidents`.
9. Зашифрованная улика: `POST /api/v1/moderation/evidence`.
10. Повторная проверка карантина: `POST /api/v1/moderation/cases/{caseId}/republication`.
11. Закрытие инцидента с перепроверкой: `POST /api/v1/moderation/incidents/{id}/resolve`.

Для API-ключей нужны scopes `moderation:read` и `moderation:write`. Ручное решение разрешено только ролям `owner` и `admin`.

## Безопасная деградация

При отсутствии ключа, отключённом AI, таймауте, ошибке провайдера или невалидном JSON:

- карточка не публикуется;
- кейс остаётся в `AI_REVIEW_REQUIRED` или `SECOND_AI_REVIEW`;
- сохраняются код ошибки и отметка о возможности повтора;
- очередь людей автоматически не заполняется;
- алгоритмические одобрения и жёсткие отклонения продолжают работать.

Аварийная остановка внешнего AI:

```env
MODERATION_KILL_SWITCH=true
```

## Проверка перед production

- секрет добавлен в защищённые переменные среды;
- endpoint провайдера доступен только серверу;
- включён TLS;
- настроены лимиты расходов и сетевые таймауты;
- выполнены `npm run check` и `npm run build`;
- проверен сценарий с отключённым провайдером;
- назначены владельцы очереди P0/P1;
- журналы `ModerationAiReview`, `ModerationHumanException`, `AiCost` и `UnifiedAudit` доступны для расследования.


## Защищённые доказательства

Для файлов апелляции нужен отдельный ключ шифрования, не OpenAI-ключ:

```bash
openssl rand -base64 32
```

Результат сохраняется только как серверный секрет `EINEIRO_MODERATION_EVIDENCE_KEY`. Без него API загрузки возвращает `EVIDENCE_STORAGE_DISABLED`, а остальная модерация продолжает работать.

Файлы:

- не попадают в публичную директорию и товарные медиа;
- шифруются AES-256-GCM с tenant-bound AAD;
- проверяются по MIME-сигнатуре и SHA-256;
- ограничены 10 МБ по умолчанию;
- доступны только участникам того же moderation case;
- удаляются фоновым процессом после срока хранения.

Повторная публикация никогда не меняет статус Offer напрямую: создаётся новое дело и заново выполняются алгоритмические правила.


## Резервное копирование доказательств

Каталог `EINEIRO_MODERATION_EVIDENCE_DIR` должен находиться на постоянном томе, а не во временной файловой системе контейнера.

Резервная копия компании включает зашифрованные контейнеры активных доказательств и проверяет их SHA-256 при восстановлении. Ключ `EINEIRO_MODERATION_EVIDENCE_KEY` намеренно не записывается в backup: после восстановления нужно предоставить тот же серверный ключ. Перенос такого backup в другую компанию запрещён, потому что шифротекст криптографически привязан к исходному tenant.

При расчёте ёмкости хранилища учитывать размер доказательств внутри каждой сохраняемой копии и значение retention для company backups.
