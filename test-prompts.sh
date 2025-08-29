#!/bin/bash

# Comprehensive Chat Agent Test Prompts
# Usage: ./test-prompts.sh [category]

CHAT_URL="http://localhost:3000/chat"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test a prompt
test_prompt() {
    local prompt="$1"
    local category="$2"
    
    echo -e "${BLUE}🔸 Testing: ${NC}\"$prompt\""
    
    start_time=$(date +%s%3N)
    response=$(curl -s -X POST "$CHAT_URL" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$prompt\"}")
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        records=$(echo "$response" | jq -r '.recordCount // 0')
        query_type=$(echo "$response" | jq -r '.queryType // "unknown"')
        bundle_used=$(echo "$response" | jq -r '.bundleUsed // false')
        dynamic_query=$(echo "$response" | jq -r '.dynamicQuery // false')
        message=$(echo "$response" | jq -r '.message' | cut -c1-100)
        
        echo -e "${GREEN}✅ Success${NC} (${duration}ms) - $records records"
        echo -e "   Query Type: $query_type"
        echo -e "   Bundle: $([ "$bundle_used" = "true" ] && echo "🎯" || echo "❌") Dynamic: $([ "$dynamic_query" = "true" ] && echo "🧠" || echo "❌")"
        echo -e "   Response: \"$message...\""
    else
        error=$(echo "$response" | jq -r '.error // "Unknown error"')
        echo -e "${RED}❌ Failed:${NC} $error"
    fi
    echo ""
}

# Test categories
echo -e "${YELLOW}🧪 COMPREHENSIVE CHAT AGENT CAPABILITY TESTS${NC}"
echo "=============================================="
echo ""

if [ "$1" = "basic" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 BASIC DATA QUERIES${NC}"
    echo "----------------------------------------"
    test_prompt "Show me recent opportunities" "basic"
    test_prompt "What opportunities do we have?" "basic" 
    test_prompt "List our current deals" "basic"
fi

if [ "$1" = "custom" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 CUSTOM FIELD INTELLIGENCE${NC}"
    echo "----------------------------------------"
    test_prompt "Show me opportunities with high likelihood scores" "custom"
    test_prompt "Find deals with good probability ratings" "custom"
    test_prompt "Which opportunities have likelihood data?" "custom"
fi

if [ "$1" = "context" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 CONTEXT BUNDLE PATTERNS${NC}"
    echo "----------------------------------------"
    test_prompt "What deals are in our pipeline?" "context"
    test_prompt "What deals are closing this quarter?" "context"
    test_prompt "Show me our latest deals" "context"
fi

if [ "$1" = "business" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 BUSINESS INTELLIGENCE${NC}"
    echo "----------------------------------------"
    test_prompt "What's our win rate looking like?" "business"
    test_prompt "Show me our biggest deals" "business"
    test_prompt "Find our top performing opportunities" "business"
fi

if [ "$1" = "filtering" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 FILTERING & CRITERIA${NC}"
    echo "----------------------------------------"
    test_prompt "Show me opportunities in negotiation stage" "filtering"
    test_prompt "Find deals closing next month" "filtering"
    test_prompt "What opportunities are over $50k?" "filtering"
fi

if [ "$1" = "goals" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 GOAL-ORIENTED CONVERSATIONS${NC}"
    echo "----------------------------------------"
    test_prompt "Help me analyze our Q4 pipeline" "goals"
    test_prompt "I need to create a sales forecast" "goals"
    test_prompt "Let's review our deal performance" "goals"
fi

if [ "$1" = "natural" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 NATURAL LANGUAGE VARIATIONS${NC}"
    echo "----------------------------------------"
    test_prompt "What's happening with our deals?" "natural"
    test_prompt "How are we doing with sales?" "natural"
    test_prompt "Give me the scoop on our opportunities" "natural"
fi

if [ "$1" = "analytical" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 ANALYTICAL QUERIES${NC}"
    echo "----------------------------------------"
    test_prompt "Compare our won vs lost opportunities" "analytical"
    test_prompt "What patterns do you see in our deals?" "analytical"
    test_prompt "Which factors predict deal success?" "analytical"
fi

if [ "$1" = "specific" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 SPECIFIC FIELD REFERENCES${NC}"
    echo "----------------------------------------"
    test_prompt "Show me opportunities with Likelihood__c values" "specific"
    test_prompt "Find deals where Amount is greater than 200000" "specific"
    test_prompt "What opportunities have StageName 'Negotiation'?" "specific"
fi

if [ "$1" = "conversational" ] || [ "$1" = "" ]; then
    echo -e "${YELLOW}📋 CONVERSATIONAL FOLLOW-UPS${NC}"
    echo "----------------------------------------"
    test_prompt "What would you recommend next?" "conversational"
    test_prompt "How should I prioritize these?" "conversational"
    test_prompt "What's most important here?" "conversational"
fi

echo -e "${GREEN}✨ Test suite completed!${NC}"
echo ""
echo "Usage examples:"
echo "  ./test-prompts.sh          # Run all tests"
echo "  ./test-prompts.sh basic    # Run basic queries only"
echo "  ./test-prompts.sh custom   # Run custom field tests only"
echo "  ./test-prompts.sh context  # Run context bundle tests only"
