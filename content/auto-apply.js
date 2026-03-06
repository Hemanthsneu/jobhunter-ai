/* ========================================
   JobHunter AI — Auto-Apply Engine
   Intelligent form auto-fill for ATS boards
   (Greenhouse, Lever, Ashby)
   ======================================== */

(function () {
    'use strict';

    const AutoApplyEngine = {
        profile: null,

        async loadProfile() {
            return new Promise((resolve) => {
                chrome.storage.sync.get({
                    profileName: '',
                    profileEmail: '',
                    profilePhone: '',
                    profileLinkedin: '',
                    profileGithub: '',
                    profileLocations: '',
                    profileRole: '',
                    profileYOE: '',
                    profileSalary: '',
                    needsSponsorship: false
                }, (result) => {
                    // Parse first/last name from full name
                    const nameParts = (result.profileName || '').trim().split(/\s+/);
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    const locations = (result.profileLocations || '').split(',').map(s => s.trim());

                    this.profile = {
                        fullName: result.profileName || '',
                        firstName,
                        lastName,
                        email: result.profileEmail || '',
                        phone: result.profilePhone || '',
                        linkedin: result.profileLinkedin || '',
                        github: result.profileGithub || '',
                        city: locations[0] || '',
                        state: locations[1] || '',
                        country: 'United States',
                        yearsOfExp: result.profileYOE || '',
                        currentTitle: result.profileRole || '',
                        salaryExpectation: result.profileSalary || '',
                        needsSponsorship: result.needsSponsorship,
                        workAuth: result.needsSponsorship ? 'Will require sponsorship' : 'Authorized to work'
                    };
                    resolve(this.profile);
                });
            });
        },

        // Field pattern → value function mapping
        getFieldMap() {
            const p = this.profile;
            return [
                // Name fields
                { pattern: /first.?name|fname|given.?name/i, value: p.firstName },
                { pattern: /last.?name|lname|surname|family.?name/i, value: p.lastName },
                { pattern: /full.?name|your.?name|^name$/i, value: p.fullName },

                // Contact
                { pattern: /email|e-?mail/i, value: p.email },
                { pattern: /phone|mobile|cell|telephone/i, value: p.phone },
                { pattern: /linkedin/i, value: p.linkedin },
                { pattern: /github|git.?hub/i, value: p.github },
                { pattern: /website|portfolio|personal.?site|url/i, value: p.github },

                // Location
                { pattern: /^city$|current.?city/i, value: p.city },
                { pattern: /state|province/i, value: p.state },
                { pattern: /country/i, value: p.country },

                // Work authorization
                { pattern: /authorized|work.?auth|eligible|legally/i, value: p.workAuth },
                {
                    pattern: /sponsorship|require.?sponsor|visa.?sponsor/i,
                    value: p.needsSponsorship ? 'Yes' : 'No'
                },

                // Experience
                { pattern: /years.?of.?exp|experience.?years|how.?many.?years/i, value: p.yearsOfExp },
                { pattern: /current.?title|job.?title|position|role/i, value: p.currentTitle },

                // Salary
                {
                    pattern: /salary|compensation|pay|expected.?salary|desired.?salary/i,
                    value: p.salaryExpectation
                }
            ];
        },

        getFieldLabel(input) {
            // Check multiple sources for field identity
            const sources = [
                input.getAttribute('aria-label'),
                input.getAttribute('placeholder'),
                input.getAttribute('name'),
                input.getAttribute('id'),
                this.findAssociatedLabel(input)
            ];
            return sources.filter(Boolean).join(' ').toLowerCase();
        },

        findAssociatedLabel(input) {
            // <label for="id">
            if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (label) return label.textContent.trim();
            }
            // Parent <label>
            const parentLabel = input.closest('label');
            if (parentLabel) return parentLabel.textContent.trim();
            // Sibling or nearby label
            const prev = input.previousElementSibling;
            if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN')) {
                return prev.textContent.trim();
            }
            // Fieldset legend
            const fieldset = input.closest('fieldset');
            if (fieldset) {
                const legend = fieldset.querySelector('legend');
                if (legend) return legend.textContent.trim();
            }
            return '';
        },

        fillField(input, value) {
            if (!value || input.disabled || input.readOnly) return false;

            // Handle select elements
            if (input.tagName === 'SELECT') {
                return this.fillSelect(input, value);
            }

            // Handle checkboxes/radios
            if (input.type === 'checkbox' || input.type === 'radio') {
                return this.fillCheckboxRadio(input, value);
            }

            // Text inputs and textareas — use native setter for React/Vue compatibility
            const nativeSetter = Object.getOwnPropertyDescriptor(
                input.tagName === 'TEXTAREA'
                    ? window.HTMLTextAreaElement.prototype
                    : window.HTMLInputElement.prototype,
                'value'
            )?.set;

            if (nativeSetter) {
                nativeSetter.call(input, value);
            } else {
                input.value = value;
            }

            // Fire synthetic events (critical for React-based ATS forms)
            input.dispatchEvent(new Event('focus', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));

            return true;
        },

        fillSelect(select, value) {
            const valueLower = value.toLowerCase();
            for (const option of select.options) {
                if (option.text.toLowerCase().includes(valueLower) ||
                    option.value.toLowerCase().includes(valueLower)) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            }
            return false;
        },

        fillCheckboxRadio(input, value) {
            const label = this.getFieldLabel(input);
            const valueLower = value.toLowerCase();
            const labelLower = label.toLowerCase();

            // Try to match "Yes"/"No" patterns
            if (valueLower === 'yes' && (labelLower.includes('yes') || labelLower === '')) {
                input.checked = true;
            } else if (valueLower === 'no' && labelLower.includes('no')) {
                input.checked = true;
            } else {
                return false;
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        },

        matchField(label) {
            const fieldMap = this.getFieldMap();
            for (const { pattern, value } of fieldMap) {
                if (pattern.test(label) && value) {
                    return value;
                }
            }
            return null;
        },

        async fillForm() {
            if (!this.profile) await this.loadProfile();
            if (!this.profile.fullName && !this.profile.email) {
                return { filled: 0, skipped: 0, error: 'No profile data. Add your info in Settings.' };
            }

            const inputs = document.querySelectorAll(
                'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea, select'
            );
            const results = { filled: 0, skipped: 0, failed: [] };

            for (const input of inputs) {
                // Skip already filled fields
                if (input.value && input.value.trim().length > 0) {
                    results.skipped++;
                    continue;
                }

                const label = this.getFieldLabel(input);
                if (!label) { results.skipped++; continue; }

                const value = this.matchField(label);
                if (value) {
                    const success = this.fillField(input, value);
                    if (success) {
                        results.filled++;
                        // Visual feedback — flash green border
                        input.style.transition = 'box-shadow 0.3s';
                        input.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.6)';
                        setTimeout(() => { input.style.boxShadow = ''; }, 2000);
                    } else {
                        results.failed.push(label);
                    }
                } else {
                    results.skipped++;
                }
            }

            return results;
        }
    };

    // Inject the Auto-Fill button on ATS application pages
    function shouldInjectAutoFill() {
        const url = window.location.href.toLowerCase();
        const isApplicationPage = (
            url.includes('/apply') ||
            url.includes('/application') ||
            url.includes('#app') ||
            document.querySelector('form[action*="apply"], form[action*="application"], form[data-test*="application"]')
        );
        return isApplicationPage;
    }

    function injectAutoFillButton() {
        if (!shouldInjectAutoFill()) return;
        if (document.getElementById('jh-autofill-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'jh-autofill-btn';
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Auto-Fill Application
        `;
        btn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
            transition: all 0.2s ease;
            font-family: 'Inter', -apple-system, sans-serif;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 6px 24px rgba(99, 102, 241, 0.5)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
            btn.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
        });

        btn.addEventListener('click', async () => {
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite">
                    <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line>
                </svg>
                Filling...
            `;
            btn.disabled = true;

            try {
                const results = await AutoApplyEngine.fillForm();
                if (results.error) {
                    JobHunterContent.showToast(results.error, 'warning');
                } else if (results.filled > 0) {
                    JobHunterContent.showToast(`Filled ${results.filled} field${results.filled > 1 ? 's' : ''} automatically!`, 'success');
                } else {
                    JobHunterContent.showToast('No matching fields found to fill.', 'info');
                }
            } catch (e) {
                console.error('Auto-fill error:', e);
                JobHunterContent.showToast('Auto-fill failed. Please fill manually.', 'error');
            }

            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                Auto-Fill Application
            `;
            btn.disabled = false;
        });

        // Add spin animation
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        document.head.appendChild(style);

        document.body.appendChild(btn);
    }

    // Watch for navigation to application pages (SPAs)
    const observer = new MutationObserver(() => {
        requestAnimationFrame(injectAutoFillButton);
    });

    function init() {
        injectAutoFillButton();
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500); // small delay for SPA rendering
    }
})();
