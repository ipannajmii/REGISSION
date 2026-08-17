<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => trim($validated['name']),
            'email' => strtolower(trim($validated['email'])),
            'password' => $validated['password'],
            'role' => 'user',
        ]);

        $token = $user->createToken('regission-user')->plainTextToken;

        return response()->json([
            'message' => 'Registration successful.',
            'token' => $token,
            'user' => $user,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        // REGISSION_DEFAULT_EXPECTED_ROLE_V1
        // Normal user login defaults to "user"; admin login can still
        // explicitly send expected_role="admin".
        if (! $request->filled('expected_role')) {
            $request->merge(['expected_role' => 'user']);
        }

        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'expected_role' => ['required', Rule::in(['user', 'admin'])],
        ]);

        $user = User::where(
            'email',
            strtolower(trim($validated['email']))
        )->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The email address or password is incorrect.'],
            ]);
        }

        if ($user->role !== $validated['expected_role']) {
            return response()->json([
                'message' => $validated['expected_role'] === 'admin'
                    ? 'This account does not have administrator access.'
                    : 'Administrator accounts must use the administrator login page.',
            ], 403);
        }

        $user->tokens()
            ->whereIn('name', ['regission-user', 'regission-admin'])
            ->delete();

        $tokenName = $user->role === 'admin'
            ? 'regission-admin'
            : 'regission-user';

        $token = $user->createToken($tokenName)->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $user,
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }
}