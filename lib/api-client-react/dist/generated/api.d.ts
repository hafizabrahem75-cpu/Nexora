import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AuthResponse, BadRequestResponse, ConflictResponse, ForgotPasswordRequest, HealthStatus, LoginRequest, OkResponse, RegisterRequest, ResetPasswordRequest, UnauthorizedResponse, UpdateProfileRequest, UserResponse, VerifyEmailRequest } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getRegisterUrl: () => string;
/**
 * @summary Create a new account
 */
export declare const register: (registerRequest: RegisterRequest, options?: RequestInit) => Promise<AuthResponse>;
export declare const getRegisterMutationOptions: <TError = ErrorType<BadRequestResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof register>>, TError, {
        data: BodyType<RegisterRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof register>>, TError, {
    data: BodyType<RegisterRequest>;
}, TContext>;
export type RegisterMutationResult = NonNullable<Awaited<ReturnType<typeof register>>>;
export type RegisterMutationBody = BodyType<RegisterRequest>;
export type RegisterMutationError = ErrorType<BadRequestResponse | ConflictResponse>;
/**
* @summary Create a new account
*/
export declare const useRegister: <TError = ErrorType<BadRequestResponse | ConflictResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof register>>, TError, {
        data: BodyType<RegisterRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof register>>, TError, {
    data: BodyType<RegisterRequest>;
}, TContext>;
export declare const getLoginUrl: () => string;
/**
 * @summary Sign in with email and password
 */
export declare const login: (loginRequest: LoginRequest, options?: RequestInit) => Promise<AuthResponse>;
export declare const getLoginMutationOptions: <TError = ErrorType<UnauthorizedResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginRequest>;
}, TContext>;
export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginRequest>;
export type LoginMutationError = ErrorType<UnauthorizedResponse>;
/**
* @summary Sign in with email and password
*/
export declare const useLogin: <TError = ErrorType<UnauthorizedResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginRequest>;
}, TContext>;
export declare const getLogoutUrl: () => string;
/**
 * @summary Invalidate current session
 */
export declare const logout: (options?: RequestInit) => Promise<OkResponse>;
export declare const getLogoutMutationOptions: <TError = ErrorType<UnauthorizedResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export type LogoutMutationResult = NonNullable<Awaited<ReturnType<typeof logout>>>;
export type LogoutMutationError = ErrorType<UnauthorizedResponse>;
/**
* @summary Invalidate current session
*/
export declare const useLogout: <TError = ErrorType<UnauthorizedResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export declare const getGetMeUrl: () => string;
/**
 * @summary Get the current authenticated user
 */
export declare const getMe: (options?: RequestInit) => Promise<UserResponse>;
export declare const getGetMeQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetMeQueryOptions: <TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<UnauthorizedResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMeQueryResult = NonNullable<Awaited<ReturnType<typeof getMe>>>;
export type GetMeQueryError = ErrorType<UnauthorizedResponse>;
/**
 * @summary Get the current authenticated user
 */
export declare function useGetMe<TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<UnauthorizedResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateProfileUrl: () => string;
/**
 * @summary Update display name and avatar
 */
export declare const updateProfile: (updateProfileRequest: UpdateProfileRequest, options?: RequestInit) => Promise<UserResponse>;
export declare const getUpdateProfileMutationOptions: <TError = ErrorType<UnauthorizedResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProfile>>, TError, {
        data: BodyType<UpdateProfileRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateProfile>>, TError, {
    data: BodyType<UpdateProfileRequest>;
}, TContext>;
export type UpdateProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateProfile>>>;
export type UpdateProfileMutationBody = BodyType<UpdateProfileRequest>;
export type UpdateProfileMutationError = ErrorType<UnauthorizedResponse>;
/**
* @summary Update display name and avatar
*/
export declare const useUpdateProfile: <TError = ErrorType<UnauthorizedResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProfile>>, TError, {
        data: BodyType<UpdateProfileRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateProfile>>, TError, {
    data: BodyType<UpdateProfileRequest>;
}, TContext>;
export declare const getForgotPasswordUrl: () => string;
/**
 * @summary Request a password reset email
 */
export declare const forgotPassword: (forgotPasswordRequest: ForgotPasswordRequest, options?: RequestInit) => Promise<OkResponse>;
export declare const getForgotPasswordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof forgotPassword>>, TError, {
        data: BodyType<ForgotPasswordRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof forgotPassword>>, TError, {
    data: BodyType<ForgotPasswordRequest>;
}, TContext>;
export type ForgotPasswordMutationResult = NonNullable<Awaited<ReturnType<typeof forgotPassword>>>;
export type ForgotPasswordMutationBody = BodyType<ForgotPasswordRequest>;
export type ForgotPasswordMutationError = ErrorType<unknown>;
/**
* @summary Request a password reset email
*/
export declare const useForgotPassword: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof forgotPassword>>, TError, {
        data: BodyType<ForgotPasswordRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof forgotPassword>>, TError, {
    data: BodyType<ForgotPasswordRequest>;
}, TContext>;
export declare const getResetPasswordUrl: () => string;
/**
 * @summary Set a new password using a reset token
 */
export declare const resetPassword: (resetPasswordRequest: ResetPasswordRequest, options?: RequestInit) => Promise<OkResponse>;
export declare const getResetPasswordMutationOptions: <TError = ErrorType<BadRequestResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetPassword>>, TError, {
        data: BodyType<ResetPasswordRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof resetPassword>>, TError, {
    data: BodyType<ResetPasswordRequest>;
}, TContext>;
export type ResetPasswordMutationResult = NonNullable<Awaited<ReturnType<typeof resetPassword>>>;
export type ResetPasswordMutationBody = BodyType<ResetPasswordRequest>;
export type ResetPasswordMutationError = ErrorType<BadRequestResponse>;
/**
* @summary Set a new password using a reset token
*/
export declare const useResetPassword: <TError = ErrorType<BadRequestResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetPassword>>, TError, {
        data: BodyType<ResetPasswordRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof resetPassword>>, TError, {
    data: BodyType<ResetPasswordRequest>;
}, TContext>;
export declare const getVerifyEmailUrl: () => string;
/**
 * @summary Verify email address using a token
 */
export declare const verifyEmail: (verifyEmailRequest: VerifyEmailRequest, options?: RequestInit) => Promise<OkResponse>;
export declare const getVerifyEmailMutationOptions: <TError = ErrorType<BadRequestResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof verifyEmail>>, TError, {
        data: BodyType<VerifyEmailRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof verifyEmail>>, TError, {
    data: BodyType<VerifyEmailRequest>;
}, TContext>;
export type VerifyEmailMutationResult = NonNullable<Awaited<ReturnType<typeof verifyEmail>>>;
export type VerifyEmailMutationBody = BodyType<VerifyEmailRequest>;
export type VerifyEmailMutationError = ErrorType<BadRequestResponse>;
/**
* @summary Verify email address using a token
*/
export declare const useVerifyEmail: <TError = ErrorType<BadRequestResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof verifyEmail>>, TError, {
        data: BodyType<VerifyEmailRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof verifyEmail>>, TError, {
    data: BodyType<VerifyEmailRequest>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map