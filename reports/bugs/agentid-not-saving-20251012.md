# AgentId 저장 버그 리포트

## 🐛 문제 요약
대화 기록(conversation history)에 어떤 에이전트가 답변했는지 구분하기 위해 `metadata.agent_id` 필드를 추가했으나, 실제 저장된 JSON 파일에 metadata가 저장되지 않음.

## 📋 현재 상태

### 수정된 파일들
1. **src/conversation/cli-conversation-history.provider.ts** (라인 62-77)
   - `addMessage()` 메서드에 `agentId?: string` 파라미터 추가
   - Spread operator로 조건부 metadata 추가:
     ```typescript
     ...(agentId ? { metadata: { agent_id: agentId } } : {})
     ```

2. **src/cli/query.handler.ts** (라인 223-229)
   - agentName 생성 및 addMessage에 전달:
     ```typescript
     const agentNameWithModel = `${agentId}${model ? `:${model}` : ''}`;
     await conversationProvider.addMessage(threadId, 'crewx', result.response, true, agentNameWithModel);
     ```

3. **.crewx/templates/conversation-history-default.hbs**
   - 템플릿에서 agent_id 표시 추가:
     ```handlebars
     {{#if metadata.agent_id}} (@{{metadata.agent_id}}){{/if}}
     ```

### 기대 동작
```json
{
  "id": "...",
  "userId": "crewx",
  "text": "...",
  "timestamp": "...",
  "isAssistant": true,
  "metadata": {
    "agent_id": "crewx_claude_dev:sonnet"
  }
}
```

### 실제 동작
```json
{
  "id": "...",
  "userId": "crewx",
  "text": "...",
  "timestamp": "...",
  "isAssistant": true
  // ❌ metadata 필드 자체가 없음!
}
```

## 🔍 디버깅 시도 내역

### 시도 1: 파라미터 순서 확인
- ✅ addMessage 시그니처: `(threadId, userId, text, isAssistant, agentId?)`
- ✅ 호출부 순서 일치 확인

### 시도 2: Spread operator 문제 의심
- Claude가 `undefined` 필드가 JSON.stringify에서 제거되는 문제 지적
- Spread operator로 수정: `...(agentId ? { metadata: ... } : {})`
- ❌ 여전히 metadata 저장 안 됨

### 시도 3: 변수명 혼동 의심
- GLM이 `agentName` vs `agentId` 혼용 문제 지적
- `agentNameWithModel` 변수명으로 명확화
- ❌ 여전히 metadata 저장 안 됨

### 시도 4: DEBUG 로그 추가
- console.log, console.error 등 여러 위치에 DEBUG 로그 추가
- ❌ DEBUG 로그가 출력되지 않음 (필터링되거나 다른 경로로 실행?)

## 🎯 다음 개발자가 확인해야 할 것

### 1. agentId 값이 실제로 전달되는지 확인
```typescript
// query.handler.ts:227 근처에 로그 추가
console.error(`[CRITICAL-DEBUG] agentNameWithModel="${agentNameWithModel}", type=${typeof agentNameWithModel}, truthy=${!!agentNameWithModel}`);
```

### 2. addMessage 메서드가 실제로 호출되는지 확인
```typescript
// cli-conversation-history.provider.ts:68 시작 부분
async addMessage(...) {
  console.error(`[PROVIDER-DEBUG] Received agentId="${agentId}", type=${typeof agentId}, truthy=${!!agentId}`);
  // ...
}
```

### 3. Spread operator가 제대로 작동하는지 확인
```typescript
// cli-conversation-history.provider.ts:76 전후
const metadataField = agentId ? { metadata: { agent_id: agentId } } : {};
console.error(`[SPREAD-DEBUG] metadataField=${JSON.stringify(metadataField)}`);
const message: ConversationMessage = {
  // ... other fields
  ...metadataField
};
console.error(`[MESSAGE-DEBUG] message=${JSON.stringify(message)}`);
```

### 4. storage.addMessage에서 metadata가 유지되는지 확인
```typescript
// conversation-storage.service.ts 확인
// addMessage 메서드에서 message를 그대로 저장하는지, 아니면 필터링하는지 확인
```

### 5. 다른 핸들러도 확인
- `src/cli/execute.handler.ts`에서도 동일한 로직 확인
- `src/cli/chat.handler.ts`에서도 동일한 로직 확인
- 혹시 parallel mode와 single mode가 다른 경로로 실행되는지 확인

## 📝 테스트 방법

### 빌드 및 테스트
```bash
# 1. 빌드
npm run build

# 2. 테스트 실행
rm -f .crewx/conversations/test-agentid.json
crewx query "@crewx_claude_dev test agentId" --thread test-agentid

# 3. 결과 확인
cat .crewx/conversations/test-agentid.json | jq '.messages[] | {isAssistant, metadata}'

# 기대 결과:
# {
#   "isAssistant": true,
#   "metadata": {
#     "agent_id": "crewx_claude_dev:sonnet-4"
#   }
# }
```

### 로그 확인 (stderr 사용)
```bash
crewx query "@crewx_claude_dev test" --thread test 2>&1 | grep -E "(CRITICAL-DEBUG|PROVIDER-DEBUG|SPREAD-DEBUG|MESSAGE-DEBUG)"
```

## 🔧 가능한 원인 추측

1. **Spread operator 이슈**: TypeScript 컴파일 후 spread가 제대로 작동하지 않음
2. **Falsy 값 문제**: `agentNameWithModel`이 빈 문자열이거나 undefined
3. **Storage layer 필터링**: `storage.addMessage()`에서 metadata를 제거
4. **타입 불일치**: ConversationMessage interface에 metadata가 optional인데 다른 곳에서 제거
5. **실행 경로 문제**: 우리가 수정한 코드가 실제로 실행되지 않음 (다른 핸들러 사용?)

## 📂 관련 파일들

- `src/cli/query.handler.ts` - 메인 진입점
- `src/cli/execute.handler.ts` - execute 모드
- `src/cli/chat.handler.ts` - chat 모드
- `src/conversation/cli-conversation-history.provider.ts` - 저장 로직
- `src/conversation/conversation-storage.service.ts` - 실제 파일 저장
- `src/conversation/types.ts` - ConversationMessage 인터페이스
- `.crewx/templates/conversation-history-default.hbs` - 템플릿

## 💡 추천 디버깅 전략

1. **가장 먼저**: storage.service의 addMessage 메서드 확인 (metadata 필터링 여부)
2. **두 번째**: provider의 addMessage에 stderr 로그 추가 (값 확인)
3. **세 번째**: Spread operator 대신 직접 할당으로 변경해보기:
   ```typescript
   const message: ConversationMessage = {
     // ... fields
     isAssistant,
   };
   if (agentId) {
     message.metadata = { agent_id: agentId };
   }
   ```
4. **마지막**: 다른 모드(execute, chat)에서도 테스트

## ⏱️ 예상 소요 시간
- 디버깅: 30분 ~ 1시간
- 수정 및 테스트: 30분

## 📞 연락처
이 버그를 해결한 개발자는 진행 상황을 보고해주세요.
