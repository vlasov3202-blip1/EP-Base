# EINEIRO — Identity & Authorization GAP

**Источник истины:** `EINEIRO_Identity_Auth_Security_Spec_v1.md` (Library)  
**Дата фиксации:** 14 сентября 2026  
**Статус:** P0 foundation implemented; внешний запуск заблокирован оставшимися P0

## Реализовано в этой итерации

- публичная регистрация создаёт глобальные `Identity` и buyer profile без `Company`, `companyId` и роли owner;
- переданные клиентом `companyId`, `userId`, `identityId` и `role` игнорируются в buyer-регистрации;
- вход покупателя выполняется по email/password без `companyId`;
- business-пользователь остаётся tenant-scoped, а приглашение добавляет membership к существующей Identity и не создаёт вторую Identity;
- глобальные auth-account, Identity, challenge и auth-event вынесены в отдельные durable/PostgreSQL структуры;
- verification/reset-токены хранятся только как SHA-256 hash, имеют TTL, одноразовый state transition и cooldown;
- password reset использует anti-enumeration ответ и отзывает все сессии Identity;
- добавлены список сессий, точечный отзыв и revoke-all со step-up;
- API `/api/me` возвращает Identity, memberships и активный business-контекст отдельно;
- Market → «Ещё» → «Профиль» подключён к реальным register/login/logout/verify/reset API; «Приватность и безопасность» показывает и отзывает активные сессии;
- перенос anonymous state расширен до context/scene/selected offers/saved demand draft, стал идемпотентным и конфликтобезопасным;
- доставка verification/reset вынесена в HTTPS webhook; при `EINEIRO_AUTH_NOTIFIER_REQUIRED=true` сервер fail-closed без конфигурации;
- добавлены negative/security tests для privilege injection, token reuse, password reset, session revocation, PII-safe auth events и PostgreSQL v3.

## Сохранённые совместимые основы

- старые controlled/internal tenant registrations и business login;
- password hashing PBKDF2-SHA256 210k для существующих учётных записей;
- hashed server sessions, idle/absolute TTL, HttpOnly cookie, CSRF и recent re-authentication;
- tenant isolation, invitations и capability checks.

## Открытые P0 перед внешним запуском

1. Реальный email/SMS delivery-провайдер и проверка deliverability, bounce/complaint и retry/DLQ.
2. Обязательный MFA для platform admin. ROOT OWNER FIDO2/WebAuthn подключается после получения аппаратных ключей; до этого внешний Admin не открывать.
3. Persistent/distributed progressive lockout по Identity/IP/device для multi-instance production. Текущий HTTP rate limit distributed при PostgreSQL, но внутреннее окно AuthService process-local.
4. Полный account deletion/anonymization workflow и подтверждённые retention/legal правила.
5. Step-up для смены email/телефона с уведомлением старого контакта.
6. Полный backfill legacy business-users в global Identity/AuthAccount до удаления company-scoped login.

## P1

- Apple/Google provider auth и безопасный link/unlink с запретом удаления последнего метода;
- native access/refresh rotation, reuse detection и secure device storage;
- passkey для обычных пользователей;
- device/anomaly risk engine и recovery codes.

## Решение по запуску

`NO-GO` для массовой регистрации и внешнего Admin, пока не закрыты все шесть P0 выше. Локальный и закрытый Silent Run допустим только без реальных PII и с выключенным внешним входом.
