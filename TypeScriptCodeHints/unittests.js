/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */


/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, describe, it, xit, expect, beforeEach, afterEach, waitsFor, runs, $, brackets, waitsForDone */

define(function (require, exports, module) {
    "use strict";

    var Editor              = brackets.getModule("editor/Editor").Editor,
        EditorManager       = brackets.getModule("editor/EditorManager"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        SpecRunnerUtils     = brackets.getModule("spec/SpecRunnerUtils"),
        UnitTestReporter    = brackets.getModule("test/UnitTestReporter"),
        TypeScriptCodeHints = require("TypeScriptCodeHints/main");

    var extensionPath   = FileUtils.getNativeModuleDirectoryPath(module),
        testPath        = extensionPath + "/unittest-files/file1.ts",
        testDoc         = null,
        testEditor;

    /**
     * Returns an Editor suitable for use in isolation: i.e., a Document that
     * will never be set as the currentDocument or added to the working set.
     * @return {!Editor}
     */
    function createMockEditor(doc, mode, visibleRange) {
        mode = mode || "";
        
        // Initialize EditorManager
        var $editorHolder = $("<div id='mock-editor-holder'/>");
        EditorManager.setEditorHolder($editorHolder);
        EditorManager._init();
        $("body").append($editorHolder);
        
        // create Editor instance
        var editor = new Editor(doc, true, mode, $editorHolder.get(0), visibleRange);
        
        return editor;
    }

    describe("TypeScript Code Hinting", function () {

        // Ask provider for hints at current cursor position; expect it to return some
        function expectHints(provider, key) {
            if (key === undefined) {
                key = null;
            }
            
            expect(provider.hasHints(testEditor, key)).toBe(true);
            return provider.getHints(null);
        }
        
        // Ask provider for hints at current cursor position; expect it NOT to return any
        function expectNoHints(provider, key) {
            
            if (key === undefined) {
                key = null;
            }
            
            expect(provider.hasHints(testEditor, key)).toBe(false);
        }

        function _indexOf(hintList, hint) {
            var index = -1,
                counter = 0;
            
            for (counter; counter < hintList.length; counter++) {
                if (hintList[counter].data("entry").name === hint) {
                    index = counter;
                    break;
                }
            }
            return index;
        }
        
        function _waitForHints(hintObj, callback) {
            var complete = false,
                hintList = null;

            if (hintObj.hasOwnProperty("hints")) {
                complete = true;
                hintList = hintObj.hints;
            } else {
                hintObj.done(function (obj) {
                    complete = true;
                    hintList = obj.hints;
                });
            }
            
            waitsFor(function () {
                return complete;
            }, "Expected hints did not resolve", 3000);

            runs(function () { callback(hintList); });
        }
        
        
        function hintsAbsent(hintObj, expectedHints) {
            _waitForHints(hintObj, function (hintList) {
                expect(hintList).not.toBeNull();
                expectedHints.forEach(function (expectedHint) {
                    expect(_indexOf(hintList, expectedHint)).toBe(-1);
                });
            });
        }

        function hintsPresent(hintObj, expectedHints) {
            _waitForHints(hintObj, function (hintList) {
                expect(hintList).not.toBeNull();
                expectedHints.forEach(function (expectedHint) {
                    expect(_indexOf(hintList, expectedHint)).not.toBe(-1);
                });
            });
        }

        function hintsPresentOrdered(hintObj, expectedHints) {
            var prevIndex = -1,
                currIndex;
            
            _waitForHints(hintObj, function (hintList) {
                expect(hintList).not.toBeNull();
                expectedHints.forEach(function (expectedHint) {
                    currIndex = _indexOf(hintList, expectedHint);
                    expect(currIndex).toBeGreaterThan(prevIndex);
                    prevIndex = currIndex;
                });
            });
        }
        
        function hintsPresentExact(hintObj, expectedHints) {
            _waitForHints(hintObj, function (hintList) {
                expect(hintList).not.toBeNull();
                expectedHints.forEach(function (expectedHint, index) {
                    expect(hintList[index].data("entry").name).toBe(expectedHint);
                });
            });
        }
        
        function selectHint(provider, hintObj, index) {
            var hintList = expectHints(provider);
            _waitForHints(hintObj, function (hintList) {
                expect(hintList).not.toBeNull();
                expect(hintList[index].data("entry")).not.toBeNull();
                expect(provider.insertHint(hintList[index])).toBe(false);
            });
        }
        
        describe("TypeScript Code Hinting in JavaScript-like code", function () {
   
            beforeEach(function () {
                DocumentManager.getDocumentForPath(testPath).done(function (doc) {
                    testDoc = doc;
                });
                
                waitsFor(function () {
                    return testDoc !== null;
                }, "Unable to open test document", 10000);
                
                // create Editor instance (containing a CodeMirror instance)
                runs(function () {
                    testEditor = createMockEditor(testDoc, "typescript");
                    ///TypeScriptCodeHints.handleEditorChange(testEditor);
                });
            });
            
            afterEach(function () {
                // The following call ensures that the document is reloaded 
                // from disk before each test
                DocumentManager.closeAll();
                
                SpecRunnerUtils.destroyMockEditor(testDoc);
                testEditor = null;
                testDoc = null;
            });
            
            it("should list declared variable and function names in outer scope", function () {
                testEditor.setCursorPos({ line: 6, ch: 0 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                ///hintsPresentExact(hintObj, ["A2", "A3", "funB", "A1"]);
                hintsPresent(hintObj, ["A2", "A3", "funB", "A1"]);
            });

            it("should filter hints by query", function () {
                testEditor.setCursorPos({ line: 5, ch: 10 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                ///hintsPresentExact(hintObj, ["A2", "A3", "A1"]);
                hintsPresent(hintObj, ["A2", "A3", "A1"]);
                hintsAbsent(hintObj, ["funB"]);
            });
            
//            it("should list keywords", function () {
//                testEditor.setCursorPos({ line: 6, ch: 0 });
//                var hintObj = expectHints(JSCodeHints.jsHintProvider);
//                hintsPresent(hintObj, ["function", "var", "switch"]);
//            });
//            
//            it("should list explicitly defined globals from JSLint annotations", function () {
//                testEditor.setCursorPos({ line: 6, ch: 0 });
//                var hintObj = expectHints(JSCodeHints.jsHintProvider);
//                hintsPresent(hintObj, ["brackets", "$"]);
//            });
//            
//            it("should list implicitly defined globals from JSLint annotations", function () {
//                testEditor.setCursorPos({ line: 6, ch: 0 });
//                var hintObj = expectHints(JSCodeHints.jsHintProvider);
//                hintsPresent(hintObj, ["alert", "console", "confirm", "navigator", "window", "frames"]);
//            });
//            
//            it("should NOT list implicitly defined globals from missing JSLint annotations", function () {
//                testEditor.setCursorPos({ line: 6, ch: 0 });
//                var hintObj = expectHints(JSCodeHints.jsHintProvider);
//                hintsAbsent(hintObj, ["ActiveXObject", "CScript", "VBArray"]);
//            });
//            
//            it("should NOT list explicitly defined globals from JSLint annotations in other files", function () {
//                testEditor.setCursorPos({ line: 6, ch: 0 });
//                var hintObj = expectHints(JSCodeHints.jsHintProvider);
//                hintsAbsent(hintObj, ["crazyGlobal", "anotherCrazyGlobal"]);
//            });
//            
//            it("should NOT list implicitly defined globals from JSLint annotations in other files", function () {
//                testEditor.setCursorPos({ line: 6, ch: 0 });
//                var hintObj = expectHints(JSCodeHints.jsHintProvider);
//                hintsAbsent(hintObj, ["spawn", "version", "toint32"]);
//            });
//            
//            it("should list literal constants", function () {
//                testEditor.setCursorPos({ line: 6, ch: 0 });
//                var hintObj = expectHints(JSCodeHints.jsHintProvider);
//                hintsPresent(hintObj, ["null", "undefined", "true", "false"]);
//            });

            it("should list accessible variables and function names in other files", function () {
                testEditor.setCursorPos({ line: 6, ch: 0 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                hintsPresent(hintObj, ["D1", "D2", "funE"]);
            });
            
            it("should NOT list variables, function names and parameter names out of scope", function () {
                testEditor.setCursorPos({ line: 6, ch: 0 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                hintsAbsent(hintObj, ["paramB2", "paramB1"]);
            });

            it("should NOT list not accessible variables and parameter names in other files", function () {
                testEditor.setCursorPos({ line: 6, ch: 0 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                hintsAbsent(hintObj, ["E1", "E2", "paramE1", "paramE2"]);
            });
            
            it("should NOT property names on value lookups", function () {
                testEditor.setCursorPos({ line: 6, ch: 0 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                hintsAbsent(hintObj, ["propA", "propB", "propC"]);
            });
            
            it("should list declared variable, function and parameter names in inner scope", function () {
                testEditor.setCursorPos({ line: 12, ch: 0 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                ///hintsPresentExact(hintObj, ["funC", "B2", "B1", "paramB2", "paramB1", "funB", "A2", "A3", "A1"]);
                hintsPresent(hintObj, ["funC", "B2", "B1", "paramB2", "paramB1", "funB", "A2", "A3", "A1"]);
            });
            
            it("should list property names that occur in the file", function () {
                testEditor.setCursorPos({ line: 17, ch: 11 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                hintsPresentExact(hintObj, ["propB"]);
            });
            
//            it("should list property names that occur in other files", function () {
//                testEditor.setCursorPos({ line: 17, ch: 11 });
//                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
//                hintsPresent(hintObj, ["propD", "propE"]);
//            });
            
            it("should NOT list variable, parameter or function names on property lookups", function () {
                testEditor.setCursorPos({ line: 17, ch: 11 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                hintsAbsent(hintObj, ["A1", "A2", "funB", "paramB1", "paramB2", "B1", "B2", "funC", "paramC1", "paramC2"]);
            });
            
            it("should NOT list keywords on property lookups", function () {
                testEditor.setCursorPos({ line: 17, ch: 11 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                hintsAbsent(hintObj, ["case", "function", "var"]);
            });
            
            it("should NOT list implicit hints on left-brace", function () {
                testEditor.setCursorPos({ line: 6, ch: 0 });
                expectNoHints(TypeScriptCodeHints.tsHintProvider, "{");
            });
            
            it("should list implicit hints when typing variable names", function () {
                testEditor.setCursorPos({ line: 6, ch: 0 });
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                ///hintsPresentExact(hintObj, ["A2", "A3", "funB", "A1"]);
                hintsPresent(hintObj, ["A2", "A3", "funB", "A1"]);
            });
            
            it("should list implicit hints when typing property lookups", function () {
                testEditor.setCursorPos({ line: 17, ch: 10 });
                expectHints(TypeScriptCodeHints.tsHintProvider, ".");
            });
            
            it("should insert value hints with no current query", function () {
                var start = { line: 6, ch: 0 },
                    end   = { line: 6, ch: 4 };

                testEditor.setCursorPos(start);
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                selectHint(TypeScriptCodeHints.tsHintProvider, hintObj, 1); // hint 1 is "bool"
                runs(function () {
                    expect(testEditor.getCursorPos()).toEqual(end);
                    expect(testDoc.getRange(start, end)).toEqual("bool");
                });
            });
            
            it("should insert value hints replacing the current query", function () {
                var start   = { line: 5, ch: 10 }, // A3 = A<here>2;
                    before  = { line: 5, ch: 9 },
                    end     = { line: 5, ch: 11 };

                testEditor.setCursorPos(start);
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                hintsPresentExact(hintObj, ["A1", "A2", "A3"]);
                selectHint(TypeScriptCodeHints.tsHintProvider, hintObj, 2); // hint 2 is "A3"
                runs(function () {
                    expect(testEditor.getCursorPos()).toEqual(end);
                    expect(testDoc.getRange(before, end)).toEqual("A3");
                });
            });
            
            it("should insert property hints with no current query", function () {
                var start   = { line: 6, ch: 0 },
                    middle  = { line: 6, ch: 3 },
                    end     = { line: 6, ch: 8 };

                testDoc.replaceRange("A1.", start, start);
                testEditor.setCursorPos(middle);
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                selectHint(TypeScriptCodeHints.tsHintProvider, hintObj, 0); // hint 0 is "propA"
                
                runs(function () {
                    expect(testEditor.getCursorPos()).toEqual(end);
                    expect(testDoc.getRange(start, end)).toEqual("A1.propA");
                    ///expect(testDoc.getLine(end.line).length).toEqual(8);
                });
            });
            
            it("should replace property hints with no current query", function () {
                var start   = { line: 6, ch: 0 },
                    middle  = { line: 6, ch: 3 },
                    end     = { line: 6, ch: 8 };

                testDoc.replaceRange("A1.prop", start, start);
                testEditor.setCursorPos(middle);
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                selectHint(TypeScriptCodeHints.tsHintProvider, hintObj, 0); // hint 0 is "propA"
                
                runs(function () {
                    expect(testEditor.getCursorPos()).toEqual(end);
                    expect(testDoc.getRange(start, end)).toEqual("A1.propA");
                    ///expect(testDoc.getLine(end.line).length).toEqual(8);
                });
            });
            
            it("should replace property hints with a partial current query", function () {
                var start   = { line: 6, ch: 0 },
                    middle  = { line: 6, ch: 6 },
                    end     = { line: 6, ch: 8 };
                
                testDoc.replaceRange("A1.pro", start, start);
                testEditor.setCursorPos(middle);
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                selectHint(TypeScriptCodeHints.tsHintProvider, hintObj, 0); // hint 0 is "propA"
                runs(function () {
                    expect(testEditor.getCursorPos()).toEqual(end);
                    expect(testDoc.getRange(start, end)).toEqual("A1.propA");
                    ///expect(testDoc.getLine(end.line).length).toEqual(8);
                });
            });

            it("should replace property hints replacing a partial current query", function () {
                var start   = { line: 6, ch: 0 },
                    middle  = { line: 6, ch: 6 },
                    end     = { line: 6, ch: 8 };
                
                testDoc.replaceRange("A1.propB", start, start);
                testEditor.setCursorPos(middle);
                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
                selectHint(TypeScriptCodeHints.tsHintProvider, hintObj, 0); // hint 0 is "propA"
                runs(function () {
                    expect(testEditor.getCursorPos()).toEqual(end);
                    expect(testDoc.getRange(start, end)).toEqual("A1.propA");
                    ///expect(testDoc.getLine(end.line).length).toEqual(8);
                });
            });
            
//            it("should replace property hints but not following delimiters", function () {
//                var start   = { line: 6, ch: 0 },
//                    middle  = { line: 6, ch: 4 },
//                    end     = { line: 6, ch: 9 },
//                    endplus = { line: 6, ch: 10 };
//
//                testDoc.replaceRange("(A1.prop)", start, start);
//                testEditor.setCursorPos(middle);
//                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
//                selectHint(TypeScriptCodeHints.tsHintProvider, hintObj, 0); // hint 0 is "propA"
//                
//                runs(function () {
//                    expect(testEditor.getCursorPos()).toEqual(end);
//                    expect(testDoc.getRange(start, endplus)).toEqual("(A1.propA)");
//                    expect(testDoc.getLine(endplus.line).length).toEqual(10);
//                });
//            });
            
        });
        
//        //TODO TOM: change fichier testPath ici pour pointer sur un nouveau fichier.ts
//        // et tester le code hint avec les class, propriété, méthodes...
//        describe("TypeScript Code Hinting", function () {
//   
//            beforeEach(function () {
//                DocumentManager.getDocumentForPath(testPath).done(function (doc) {
//                    testDoc = doc;
//                });
//                
//                waitsFor(function () {
//                    return testDoc !== null;
//                }, "Unable to open test document", 10000);
//                
//                // create Editor instance (containing a CodeMirror instance)
//                runs(function () {
//                    testEditor = createMockEditor(testDoc, "typescript");
//                    ////TypeScriptCodeHints.handleEditorChange(testEditor);
//                });
//            });
//            
//            afterEach(function () {
//                // The following call ensures that the document is reloaded 
//                // from disk before each test
//                DocumentManager.closeAll();
//                
//                SpecRunnerUtils.destroyMockEditor(testDoc);
//                testEditor = null;
//                testDoc = null;
//            });
//            
//            it("should list declared variable and function names in outer scope", function () {
//                testEditor.setCursorPos({ line: 6, ch: 0 });
//                var hintObj = expectHints(TypeScriptCodeHints.tsHintProvider);
//                ///hintsPresentExact(hintObj, ["A2", "A3", "funB", "A1"]);
//                hintsPresent(hintObj, ["A2", "A3", "funB", "A1"]);
//            });
//            
//        });

    });
});